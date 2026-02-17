// Package vibekanbanplugins implements a Caddy HTTP handler that injects
// plugin system code into Vibe Kanban responses.
package vibekanbanplugins

import (
	"bufio"
	"bytes"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"go.uber.org/zap"
)

func init() {
	caddy.RegisterModule(PluginInjector{})
}

// PluginInjector injects plugin system code into HTML responses.
type PluginInjector struct {
	// InjectionScriptPath is the path to a JavaScript file to load at startup (optional)
	InjectionScriptPath string `json:"injection_script_path,omitempty"`

	// InjectionScript is direct JavaScript content to inject (takes precedence over path)
	InjectionScript string `json:"injection_script,omitempty"`

	// cachedScript is the loaded script content (loaded during provision)
	cachedScript string

	logger *zap.Logger
}

// CaddyModule returns the Caddy module information.
func (PluginInjector) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.vibe_kanban_plugin_injector",
		New: func() caddy.Module { return new(PluginInjector) },
	}
}

// getEmbeddedScript returns the default embedded injection script.
func getEmbeddedScript() string {
	return `// Vibe Kanban Plugin System
console.log('[Vibe Kanban] Plugin system initialized');
window.__VIBE_KANBAN_PLUGINS__ = {
  version: '1.0.0',
  timestamp: Date.now(),
  injectedBy: 'caddy-plugin-injector'
};`
}

// Provision implements caddy.Provisioner.
func (p *PluginInjector) Provision(ctx caddy.Context) error {
	p.logger = ctx.Logger(p)

	// Priority: direct content > file path > embedded default
	if p.InjectionScript != "" {
		p.cachedScript = p.InjectionScript
		p.logger.Info("using direct injection script",
			zap.Int("size", len(p.cachedScript)))
	} else if p.InjectionScriptPath != "" {
		data, err := os.ReadFile(p.InjectionScriptPath)
		if err != nil {
			return fmt.Errorf("failed to read injection script from %s: %w", p.InjectionScriptPath, err)
		}
		p.cachedScript = string(data)
		p.logger.Info("loaded injection script from file",
			zap.String("path", p.InjectionScriptPath),
			zap.Int("size", len(p.cachedScript)))
	} else {
		p.cachedScript = getEmbeddedScript()
		p.logger.Info("using embedded default injection script",
			zap.Int("size", len(p.cachedScript)))
	}

	return nil
}

// responseRecorder buffers the upstream response for processing.
type responseRecorder struct {
	http.ResponseWriter // embed the original ResponseWriter for interface delegation
	statusCode          int
	headers             http.Header
	body                *bytes.Buffer
	wroteHeader         bool
}

// newResponseRecorder creates a new response recorder.
func newResponseRecorder(w http.ResponseWriter) *responseRecorder {
	return &responseRecorder{
		ResponseWriter: w, // store original for Hijacker/Flusher support
		statusCode:     200, // default status
		headers:        make(http.Header),
		body:           new(bytes.Buffer),
	}
}

// Header implements http.ResponseWriter.
func (r *responseRecorder) Header() http.Header {
	return r.headers
}

// Write implements http.ResponseWriter.
func (r *responseRecorder) Write(b []byte) (int, error) {
	if !r.wroteHeader {
		r.WriteHeader(http.StatusOK)
	}
	return r.body.Write(b)
}

// WriteHeader implements http.ResponseWriter.
func (r *responseRecorder) WriteHeader(statusCode int) {
	if !r.wroteHeader {
		r.statusCode = statusCode
		r.wroteHeader = true
	}
}

// Hijack implements http.Hijacker interface.
// This is required for WebSocket upgrades and other protocol switching.
func (r *responseRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("underlying ResponseWriter does not support hijacking")
	}
	return hijacker.Hijack()
}

// Flush implements http.Flusher interface.
// This is required for streaming responses and chunked encoding.
func (r *responseRecorder) Flush() {
	if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

// isUpgradeRequest checks if the request is attempting to upgrade protocols.
func isUpgradeRequest(r *http.Request) bool {
	// Check for Upgrade header (WebSocket, HTTP/2, etc.)
	upgrade := r.Header.Get("Upgrade")
	connection := r.Header.Get("Connection")

	// WebSocket and other protocol upgrades use "Upgrade" header
	// and "Connection: Upgrade" header
	return upgrade != "" || strings.Contains(strings.ToLower(connection), "upgrade")
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (p *PluginInjector) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	// Check if this is a protocol upgrade request (WebSocket, HTTP/2, etc.)
	// These requests require direct connection hijacking and cannot be buffered
	if isUpgradeRequest(r) {
		if p.logger != nil {
			p.logger.Debug("bypassing injection for protocol upgrade request",
				zap.String("upgrade", r.Header.Get("Upgrade")),
				zap.String("connection", r.Header.Get("Connection")))
		}
		// Pass through directly without buffering
		return next.ServeHTTP(w, r)
	}

	// Create a response recorder to buffer the upstream response
	rec := newResponseRecorder(w)

	// Call the next handler with our recorder
	err := next.ServeHTTP(rec, r)
	if err != nil {
		return err
	}

	// Process the buffered response (inject if HTML)
	processedBody := p.processResponse(rec.headers, rec.body.Bytes())

	// Copy headers from recorder to actual response writer
	for key, values := range rec.headers {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Update Content-Length header with new body size
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(processedBody)))

	// Write status code
	w.WriteHeader(rec.statusCode)

	// Check if we should write a body according to HTTP semantics
	// Per RFC 7231 and RFC 7232, certain responses MUST NOT have a body
	shouldWriteBody := p.shouldWriteResponseBody(r.Method, rec.statusCode)

	if shouldWriteBody {
		w.Write(processedBody)
	}

	return nil
}

// shouldWriteResponseBody determines if a response body should be written
// based on HTTP method and status code semantics.
func (p *PluginInjector) shouldWriteResponseBody(method string, statusCode int) bool {
	// HEAD requests must not have a response body (RFC 7231 section 4.3.2)
	if method == http.MethodHead {
		return false
	}

	// 1xx informational responses must not have a body
	if statusCode >= 100 && statusCode < 200 {
		return false
	}

	// 204 No Content must not have a body
	if statusCode == http.StatusNoContent {
		return false
	}

	// 304 Not Modified must not have a body (RFC 7232 section 4.1)
	if statusCode == http.StatusNotModified {
		return false
	}

	// All other cases should have a body
	return true
}

// processResponse checks if the response is HTML and injects the script if needed.
func (p *PluginInjector) processResponse(headers http.Header, body []byte) []byte {
	// Skip injection if response is compressed (would corrupt the output)
	contentEncoding := headers.Get("Content-Encoding")
	if contentEncoding != "" {
		return body
	}

	// Check Content-Type header (case-insensitive)
	contentType := headers.Get("Content-Type")

	// Only process text/html responses
	if !strings.Contains(strings.ToLower(contentType), "text/html") {
		return body
	}

	// Inject script into HTML
	return p.injectIntoHTML(body)
}

// injectIntoHTML injects the plugin script before the </body> tag.
func (p *PluginInjector) injectIntoHTML(html []byte) []byte {
	// Use the cached script loaded during provision
	if p.cachedScript == "" {
		if p.logger != nil {
			p.logger.Warn("no cached script available, skipping injection")
		}
		return html
	}

	// Wrap script in <script> tags
	var injectionScript bytes.Buffer
	injectionScript.WriteString("<script>\n")
	injectionScript.WriteString(p.cachedScript)
	injectionScript.WriteString("\n</script>\n")

	// Find </body> tag (case-insensitive)
	bodyCloseTag := []byte("</body>")
	bodyIndex := bytes.Index(bytes.ToLower(html), bytes.ToLower(bodyCloseTag))

	// If </body> not found, just return the original HTML
	if bodyIndex == -1 {
		if p.logger != nil {
			p.logger.Debug("no </body> tag found, skipping injection")
		}
		return html
	}

	// Build the modified HTML
	var result bytes.Buffer
	result.Write(html[:bodyIndex])        // Everything before </body>
	result.Write(injectionScript.Bytes()) // Injected script
	result.Write(html[bodyIndex:])        // </body> and everything after

	if p.logger != nil {
		p.logger.Debug("injected plugin script into HTML")
	}

	return result.Bytes()
}

// Interface guards - ensure we implement required interfaces
var (
	_ caddy.Provisioner           = (*PluginInjector)(nil)
	_ caddyhttp.MiddlewareHandler = (*PluginInjector)(nil)
	_ http.ResponseWriter         = (*responseRecorder)(nil)
	_ http.Hijacker               = (*responseRecorder)(nil)
	_ http.Flusher                = (*responseRecorder)(nil)
)
