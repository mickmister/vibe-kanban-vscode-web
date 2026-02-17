// Package vibekanbanplugins implements a Caddy HTTP handler that rewrites
// Vibe Kanban API URLs in JavaScript responses to point to a custom cloud instance.
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
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"go.uber.org/zap"
)

func init() {
	caddy.RegisterModule(PluginInjector{})
	httpcaddyfile.RegisterHandlerDirective("vk_rewrite", parseCaddyfile)
	httpcaddyfile.RegisterDirectiveOrder("vk_rewrite", "before", "reverse_proxy")
}

// PluginInjector rewrites Vibe Kanban API URLs in JavaScript responses.
type PluginInjector struct {
	// CloudURL is the URL of the self-hosted VK cloud instance (reads from env if not set)
	CloudURL string `json:"cloud_url,omitempty"`

	// resolvedCloudURL is the final URL after env var resolution
	resolvedCloudURL string

	logger *zap.Logger
}

// CaddyModule returns the Caddy module information.
func (PluginInjector) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.vibe_kanban_rewriter",
		New: func() caddy.Module { return new(PluginInjector) },
	}
}

// parseCaddyfile sets up the handler from Caddyfile tokens.
// Syntax: vk_rewrite [<cloud_url>]
// If cloud_url is not provided, reads from VK_CLOUD_URL env var.
func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	var p PluginInjector

	// Optional: read cloud URL from directive argument
	for h.Next() {
		args := h.RemainingArgs()
		if len(args) > 1 {
			return nil, h.ArgErr()
		}
		if len(args) == 1 {
			p.CloudURL = args[0]
		}
	}

	return &p, nil
}

// Provision implements caddy.Provisioner.
func (p *PluginInjector) Provision(ctx caddy.Context) error {
	p.logger = ctx.Logger(p)

	// Resolve cloud URL: explicit config > VK_CLOUD_URL env > error
	if p.CloudURL != "" {
		p.resolvedCloudURL = p.CloudURL
		p.logger.Info("using configured cloud URL",
			zap.String("url", p.resolvedCloudURL))
	} else if envURL := os.Getenv("VK_CLOUD_URL"); envURL != "" {
		p.resolvedCloudURL = envURL
		p.logger.Info("using cloud URL from VK_CLOUD_URL env var",
			zap.String("url", p.resolvedCloudURL))
	} else {
		return fmt.Errorf("vk_rewrite: no cloud URL configured (set VK_CLOUD_URL env var or pass as directive argument)")
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

// processResponse checks if the response is JavaScript and rewrites API URLs if needed.
func (p *PluginInjector) processResponse(headers http.Header, body []byte) []byte {
	// Skip rewrite if response is compressed (would corrupt the output)
	contentEncoding := headers.Get("Content-Encoding")
	if contentEncoding != "" {
		return body
	}

	// Check Content-Type header (case-insensitive)
	contentType := headers.Get("Content-Type")

	// Only process JavaScript responses
	// Common content types: application/javascript, text/javascript, application/x-javascript
	contentTypeLower := strings.ToLower(contentType)
	if !strings.Contains(contentTypeLower, "javascript") {
		return body
	}

	// Rewrite API URLs in JavaScript
	return p.rewriteJavaScript(body)
}

// rewriteJavaScript replaces the official VK cloud API URL with the custom one.
func (p *PluginInjector) rewriteJavaScript(js []byte) []byte {
	// The official VK cloud API URL that appears in the npm package bundle
	officialURL := []byte("https://api.vibekanban.com")
	customURL := []byte(p.resolvedCloudURL)

	// Count occurrences for logging
	count := bytes.Count(js, officialURL)
	if count == 0 {
		// No rewrites needed
		return js
	}

	// Replace all occurrences
	rewritten := bytes.ReplaceAll(js, officialURL, customURL)

	if p.logger != nil {
		p.logger.Debug("rewrote VK cloud API URLs in JavaScript",
			zap.Int("replacements", count),
			zap.String("from", string(officialURL)),
			zap.String("to", p.resolvedCloudURL))
	}

	return rewritten
}

// Interface guards - ensure we implement required interfaces
var (
	_ caddy.Provisioner           = (*PluginInjector)(nil)
	_ caddyhttp.MiddlewareHandler = (*PluginInjector)(nil)
	_ http.ResponseWriter         = (*responseRecorder)(nil)
	_ http.Hijacker               = (*responseRecorder)(nil)
	_ http.Flusher                = (*responseRecorder)(nil)
)
