package vibekanbanplugins

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

// createTestContext creates a minimal Caddy context for testing
func createTestContext(t *testing.T) caddy.Context {
	t.Helper()
	ctx, cancel := caddy.NewContext(caddy.Context{Context: context.Background()})
	t.Cleanup(cancel)
	return ctx
}

// loadFixture loads a test fixture file
func loadFixture(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to load fixture %s: %v", path, err)
	}
	return data
}

// loadInjectionScript loads an injection script and wraps it in <script> tags
func loadInjectionScript(t *testing.T, scriptPath string) string {
	t.Helper()
	script := loadFixture(t, scriptPath)
	return fmt.Sprintf("<script>\n%s\n</script>\n", string(script))
}

// mockNextHandler creates a mock upstream handler that returns fixture data
func mockNextHandler(fixtureData []byte, statusCode int, headers http.Header) caddyhttp.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		for key, values := range headers {
			for _, value := range values {
				w.Header().Add(key, value)
			}
		}
		w.WriteHeader(statusCode)
		w.Write(fixtureData)
		return nil
	}
}

// Test 1: Verify script is injected before </body>
func TestInjectScriptIntoHTML(t *testing.T) {
	// ARRANGE: Load original HTML fixture
	originalHTML := loadFixture(t, "test-fixtures/captured/original.html")
	expectedHTML := loadFixture(t, "test-fixtures/expected/injected.html")

	// Create upstream handler that returns original HTML
	upstream := mockNextHandler(originalHTML, 200, http.Header{
		"Content-Type": []string{"text/html; charset=utf-8"},
	})

	// Create our injector handler with file path
	injector := &PluginInjector{
		InjectionScriptPath: "test-fixtures/injection-scripts/phase1-test.js",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	// Create test request
	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT: Run the handler
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Status code is 200
	if rec.Code != 200 {
		t.Errorf("Expected status 200, got %d", rec.Code)
	}

	// ASSERT: Content-Type is preserved
	contentType := rec.Header().Get("Content-Type")
	if contentType != "text/html; charset=utf-8" {
		t.Errorf("Expected Content-Type 'text/html; charset=utf-8', got '%s'", contentType)
	}

	// ASSERT: Injection script is present
	body := rec.Body.Bytes()
	if !bytes.Contains(body, []byte("Caddy Plugin Injector")) {
		t.Error("Injection script not found in response body")
	}

	// ASSERT: Injection is before </body>
	bodyCloseIndex := bytes.Index(body, []byte("</body>"))
	if bodyCloseIndex == -1 {
		t.Fatal("</body> tag not found in response")
	}

	injectionIndex := bytes.Index(body, []byte("Caddy Plugin Injector"))
	if injectionIndex > bodyCloseIndex {
		t.Error("Injection appears after </body> tag")
	}

	// ASSERT: Output matches expected (optional, strict check)
	if !bytes.Equal(body, expectedHTML) {
		t.Errorf("Output doesn't match expected HTML")
		// Save actual for inspection
		actualPath := filepath.Join("test-fixtures", "actual-output.html")
		os.WriteFile(actualPath, body, 0644)
		t.Logf("Actual output saved to %s for inspection", actualPath)

		// Show byte count differences for debugging
		t.Logf("Expected length: %d bytes, Actual length: %d bytes", len(expectedHTML), len(body))
	}
}

// Test 2: Verify JavaScript responses are not modified
func TestDoesNotInjectJavaScript(t *testing.T) {
	// ARRANGE: Create a simple JS fixture
	originalJS := []byte(`// Sample JavaScript file
console.log('Hello from JS');
function test() {
  return true;
}`)

	upstream := mockNextHandler(originalJS, 200, http.Header{
		"Content-Type": []string{"application/javascript; charset=utf-8"},
	})

	injector := &PluginInjector{
		InjectionScriptPath: "test-fixtures/injection-scripts/phase1-test.js",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/assets/main.js", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Body is unchanged
	body := rec.Body.Bytes()
	if !bytes.Equal(body, originalJS) {
		t.Error("JavaScript file was modified (should be unchanged)")
	}

	// ASSERT: No injection in JS
	if bytes.Contains(body, []byte("Caddy Plugin Injector")) {
		t.Error("Injection script found in JavaScript file (should not inject)")
	}
}

// Test 3: Verify Content-Length header is recalculated
func TestUpdatesContentLength(t *testing.T) {
	// ARRANGE
	originalHTML := loadFixture(t, "test-fixtures/captured/original.html")

	upstream := mockNextHandler(originalHTML, 200, http.Header{
		"Content-Type":   []string{"text/html; charset=utf-8"},
		"Content-Length": []string{fmt.Sprintf("%d", len(originalHTML))},
	})

	injector := &PluginInjector{
		InjectionScriptPath: "test-fixtures/injection-scripts/phase1-test.js",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Content-Length is updated
	body := rec.Body.Bytes()
	expectedLength := len(body)
	actualLength := rec.Header().Get("Content-Length")

	if actualLength != fmt.Sprintf("%d", expectedLength) {
		t.Errorf("Content-Length mismatch: expected %d, got %s", expectedLength, actualLength)
	}

	// ASSERT: Content is larger (injection added content)
	if len(body) <= len(originalHTML) {
		t.Error("Injected HTML should be larger than original")
	}
}

// Test 4: Verify graceful handling when HTML is malformed
func TestHandlesMissingBodyTag(t *testing.T) {
	// ARRANGE: HTML without </body> tag
	malformedHTML := []byte(`<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Content</h1>
<!-- Missing </body> and </html> tags -->`)

	upstream := mockNextHandler(malformedHTML, 200, http.Header{
		"Content-Type": []string{"text/html; charset=utf-8"},
	})

	injector := &PluginInjector{
		InjectionScriptPath: "test-fixtures/injection-scripts/phase1-test.js",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors (graceful degradation)
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Response is returned (even if not injected)
	body := rec.Body.Bytes()
	if len(body) == 0 {
		t.Error("Response body is empty")
	}

	// ASSERT: Either injected at end OR returned unchanged
	// (Implementation choice: we can append to end or skip injection)
	t.Log("Malformed HTML handling test passed - implementation will decide behavior")
}

// Test 5: Provision with direct script content
func TestProvisionWithDirectScript(t *testing.T) {
	// ARRANGE
	testScript := "console.log('Direct script test');"
	injector := &PluginInjector{
		InjectionScript: testScript,
	}

	// ACT
	ctx := createTestContext(t)
	err := injector.Provision(ctx)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Provision failed: %v", err)
	}

	// ASSERT: Cached script matches direct content
	if injector.cachedScript != testScript {
		t.Errorf("Expected cached script to be '%s', got '%s'", testScript, injector.cachedScript)
	}
}

// Test 6: Provision with file path
func TestProvisionWithFilePath(t *testing.T) {
	// ARRANGE
	injector := &PluginInjector{
		InjectionScriptPath: "test-fixtures/injection-scripts/phase1-test.js",
	}

	// ACT
	ctx := createTestContext(t)
	err := injector.Provision(ctx)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Provision failed: %v", err)
	}

	// ASSERT: Script was loaded from file
	if injector.cachedScript == "" {
		t.Error("Expected cached script to be loaded from file, got empty string")
	}

	// ASSERT: Script contains expected content
	if !bytes.Contains([]byte(injector.cachedScript), []byte("Phase 1 Test Injection Script")) {
		t.Error("Expected cached script to contain phase1 test script content")
	}
}

// Test 7: Provision with invalid file path
func TestProvisionWithInvalidFilePath(t *testing.T) {
	// ARRANGE
	injector := &PluginInjector{
		InjectionScriptPath: "nonexistent/script.js",
	}

	// ACT
	ctx := createTestContext(t)
	err := injector.Provision(ctx)

	// ASSERT: Error is returned
	if err == nil {
		t.Error("Expected error for invalid file path, got nil")
	}
}

// Test 8: Provision with embedded default script
func TestProvisionWithEmbeddedDefault(t *testing.T) {
	// ARRANGE
	injector := &PluginInjector{
		// No script path or content specified
	}

	// ACT
	ctx := createTestContext(t)
	err := injector.Provision(ctx)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Provision failed: %v", err)
	}

	// ASSERT: Embedded script was loaded
	if injector.cachedScript == "" {
		t.Error("Expected cached script to contain embedded default, got empty string")
	}

	// ASSERT: Script contains expected embedded content
	if !bytes.Contains([]byte(injector.cachedScript), []byte("Vibe Kanban Plugin System")) {
		t.Error("Expected cached script to contain embedded default script")
	}
}

// Test 9: Direct script takes precedence over file path
func TestProvisionDirectScriptTakesPrecedence(t *testing.T) {
	// ARRANGE
	directScript := "console.log('Direct wins');"
	injector := &PluginInjector{
		InjectionScript:     directScript,
		InjectionScriptPath: "test-fixtures/injection-scripts/phase1-test.js",
	}

	// ACT
	ctx := createTestContext(t)
	err := injector.Provision(ctx)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Provision failed: %v", err)
	}

	// ASSERT: Direct script is used, not file
	if injector.cachedScript != directScript {
		t.Errorf("Expected direct script to take precedence, got '%s'", injector.cachedScript)
	}
}

// Test 10: Injection uses cached script (no per-request file reads)
func TestInjectionUsesCachedScript(t *testing.T) {
	// ARRANGE
	customScript := "console.log('Cached script test');"
	injector := &PluginInjector{
		InjectionScript: customScript,
	}

	// Provision the injector
	ctx := createTestContext(t)
	err := injector.Provision(ctx)
	if err != nil {
		t.Fatalf("Provision failed: %v", err)
	}

	// Create test HTML
	originalHTML := []byte(`<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Content</h1>
</body>
</html>`)

	upstream := mockNextHandler(originalHTML, 200, http.Header{
		"Content-Type": []string{"text/html; charset=utf-8"},
	})

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err = injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Custom cached script is present
	body := rec.Body.Bytes()
	if !bytes.Contains(body, []byte(customScript)) {
		t.Error("Expected injected HTML to contain cached custom script")
	}

	// ASSERT: Phase1 test script is NOT present (proves we're using cached, not reading file)
	if bytes.Contains(body, []byte("Phase 1 Test Injection Script")) {
		t.Error("Injected HTML should not contain phase1 test script")
	}
}

// Test 11: Skip injection for gzip-compressed responses
func TestSkipsInjectionForGzipContent(t *testing.T) {
	// ARRANGE: Create a gzipped HTML response
	// Note: Using dummy bytes to represent gzipped content
	gzippedHTML := []byte{0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff}

	upstream := mockNextHandler(gzippedHTML, 200, http.Header{
		"Content-Type":     []string{"text/html; charset=utf-8"},
		"Content-Encoding": []string{"gzip"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Body is unchanged (not injected)
	body := rec.Body.Bytes()
	if !bytes.Equal(body, gzippedHTML) {
		t.Error("Gzipped content was modified (should be unchanged)")
	}

	// ASSERT: No injection script present
	if bytes.Contains(body, []byte("console.log('test');")) {
		t.Error("Injection script found in gzipped response (should not inject)")
	}
}

// Test 12: Skip injection for brotli-compressed responses
func TestSkipsInjectionForBrotliContent(t *testing.T) {
	// ARRANGE: Create a brotli-compressed HTML response
	brotliHTML := []byte{0xce, 0xb2, 0xcf, 0x81}

	upstream := mockNextHandler(brotliHTML, 200, http.Header{
		"Content-Type":     []string{"text/html"},
		"Content-Encoding": []string{"br"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Body is unchanged
	body := rec.Body.Bytes()
	if !bytes.Equal(body, brotliHTML) {
		t.Error("Brotli content was modified (should be unchanged)")
	}
}

// Test 13: Skip injection for deflate-compressed responses
func TestSkipsInjectionForDeflateContent(t *testing.T) {
	// ARRANGE: Create a deflate-compressed HTML response
	deflateHTML := []byte{0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01}

	upstream := mockNextHandler(deflateHTML, 200, http.Header{
		"Content-Type":     []string{"text/html; charset=utf-8"},
		"Content-Encoding": []string{"deflate"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Body is unchanged
	body := rec.Body.Bytes()
	if !bytes.Equal(body, deflateHTML) {
		t.Error("Deflate content was modified (should be unchanged)")
	}
}

// Test 14: Case-insensitive Content-Type matching - uppercase
func TestCaseInsensitiveContentTypeUppercase(t *testing.T) {
	// ARRANGE: HTML with uppercase Content-Type
	testHTML := []byte(`<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Content</h1>
</body>
</html>`)

	upstream := mockNextHandler(testHTML, 200, http.Header{
		"Content-Type": []string{"TEXT/HTML; charset=utf-8"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('case test');",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Injection script is present (case-insensitive match worked)
	body := rec.Body.Bytes()
	if !bytes.Contains(body, []byte("console.log('case test');")) {
		t.Error("Injection script not found for uppercase Content-Type (should inject)")
	}
}

// Test 15: Case-insensitive Content-Type matching - mixed case
func TestCaseInsensitiveContentTypeMixed(t *testing.T) {
	// ARRANGE: HTML with mixed-case Content-Type
	testHTML := []byte(`<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Content</h1>
</body>
</html>`)

	upstream := mockNextHandler(testHTML, 200, http.Header{
		"Content-Type": []string{"Text/Html; charset=utf-8"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('mixed case test');",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Injection script is present
	body := rec.Body.Bytes()
	if !bytes.Contains(body, []byte("console.log('mixed case test');")) {
		t.Error("Injection script not found for mixed-case Content-Type (should inject)")
	}
}

// Test 16: Compressed HTML should not be injected even with HTML Content-Type
func TestCompressedHTMLNotInjected(t *testing.T) {
	// ARRANGE: Gzipped HTML response
	gzippedHTML := []byte{0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff}

	upstream := mockNextHandler(gzippedHTML, 200, http.Header{
		"Content-Type":     []string{"text/html; charset=utf-8"},
		"Content-Encoding": []string{"gzip"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('should not appear');",
	}

	// Provision the injector
	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Body is unchanged (compression takes precedence)
	body := rec.Body.Bytes()
	if !bytes.Equal(body, gzippedHTML) {
		t.Error("Compressed HTML was modified (should skip injection)")
	}

	// ASSERT: No script injection
	if bytes.Contains(body, []byte("should not appear")) {
		t.Error("Script was injected into compressed HTML (should not inject)")
	}
}

// Test 17: Verify all common Content-Type variations are handled
func TestContentTypeVariations(t *testing.T) {
	testCases := []struct {
		name         string
		contentType  string
		shouldInject bool
	}{
		{"lowercase", "text/html", true},
		{"uppercase", "TEXT/HTML", true},
		{"mixed case 1", "Text/Html", true},
		{"mixed case 2", "text/HTML", true},
		{"with charset lowercase", "text/html; charset=utf-8", true},
		{"with charset uppercase", "TEXT/HTML; CHARSET=UTF-8", true},
		{"with charset mixed", "Text/Html; Charset=UTF-8", true},
		{"xhtml lowercase", "application/xhtml+xml", false},
		{"json", "application/json", false},
		{"javascript", "application/javascript", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// ARRANGE
			testHTML := []byte(`<!DOCTYPE html>
<html>
<body>
<h1>Test</h1>
</body>
</html>`)

			upstream := mockNextHandler(testHTML, 200, http.Header{
				"Content-Type": []string{tc.contentType},
			})

			injector := &PluginInjector{
				InjectionScript: "console.log('injection marker');",
			}

			// Provision the injector
			ctx := createTestContext(t)
			if err := injector.Provision(ctx); err != nil {
				t.Fatalf("Failed to provision injector: %v", err)
			}

			req := httptest.NewRequest("GET", "/", nil)
			rec := httptest.NewRecorder()

			// ACT
			err := injector.ServeHTTP(rec, req, upstream)

			// ASSERT: No errors
			if err != nil {
				t.Fatalf("Handler returned error: %v", err)
			}

			// ASSERT: Injection based on content type
			body := rec.Body.Bytes()
			hasInjection := bytes.Contains(body, []byte("injection marker"))

			if tc.shouldInject && !hasInjection {
				t.Errorf("Expected injection for Content-Type '%s', but not found", tc.contentType)
			}
			if !tc.shouldInject && hasInjection {
				t.Errorf("Unexpected injection for Content-Type '%s'", tc.contentType)
			}
		})
	}
}

// Test 18: HEAD request must not have a response body (RFC 7231 section 4.3.2)
func TestHEADRequestHandling(t *testing.T) {
	// ARRANGE: HTML content with normal GET request
	testHTML := []byte(`<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Content</h1>
</body>
</html>`)

	upstream := mockNextHandler(testHTML, 200, http.Header{
		"Content-Type": []string{"text/html; charset=utf-8"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	// ACT: Make HEAD request
	req := httptest.NewRequest("HEAD", "/", nil)
	rec := httptest.NewRecorder()

	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Response body must be empty for HEAD requests
	body := rec.Body.Bytes()
	if len(body) != 0 {
		t.Errorf("HEAD request must not have a response body (RFC 7231 4.3.2), got %d bytes", len(body))
	}

	// ASSERT: Content-Length should still be set correctly (as if body were sent)
	contentLength := rec.Header().Get("Content-Length")
	if contentLength == "" {
		t.Error("Content-Length header should be set for HEAD request")
	}

	// ASSERT: Status code is preserved
	if rec.Code != 200 {
		t.Errorf("Expected status 200, got %d", rec.Code)
	}
}

// Test 19: 304 Not Modified must not have a message body (RFC 7232 section 4.1)
func TestNotModifiedHandling(t *testing.T) {
	// ARRANGE: 304 response with HTML content-type
	testHTML := []byte(`<!DOCTYPE html>
<html>
<body>
<h1>Should not appear</h1>
</body>
</html>`)

	upstream := mockNextHandler(testHTML, 304, http.Header{
		"Content-Type": []string{"text/html; charset=utf-8"},
		"ETag":         []string{`"abc123"`},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("If-None-Match", `"abc123"`)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Status is 304
	if rec.Code != 304 {
		t.Errorf("Expected status 304, got %d", rec.Code)
	}

	// ASSERT: Response body must be empty for 304
	body := rec.Body.Bytes()
	if len(body) != 0 {
		t.Errorf("304 Not Modified must not have a message body (RFC 7232 4.1), got %d bytes", len(body))
	}

	// ASSERT: Headers are preserved
	etag := rec.Header().Get("ETag")
	if etag != `"abc123"` {
		t.Errorf("Expected ETag header preserved, got '%s'", etag)
	}

	// ASSERT: No injection occurred
	if bytes.Contains(body, []byte("console.log('test');")) {
		t.Error("Script should not be injected into 304 response")
	}
}

// Test 20: 204 No Content must not have a message body
func TestNoContentHandling(t *testing.T) {
	// ARRANGE: 204 response (upstream should not send body, but test defensive handling)
	emptyBody := []byte{}

	upstream := mockNextHandler(emptyBody, 204, http.Header{
		"Content-Type": []string{"text/html"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("DELETE", "/resource", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Status is 204
	if rec.Code != 204 {
		t.Errorf("Expected status 204, got %d", rec.Code)
	}

	// ASSERT: Response body must be empty for 204
	body := rec.Body.Bytes()
	if len(body) != 0 {
		t.Errorf("204 No Content must not have a message body, got %d bytes", len(body))
	}

	// ASSERT: No injection occurred
	if bytes.Contains(body, []byte("console.log('test');")) {
		t.Error("Script should not be injected into 204 response")
	}
}

// Test 21: Missing Content-Type header should skip injection
func TestMissingContentTypeHeader(t *testing.T) {
	// ARRANGE: Response with no Content-Type header
	testHTML := []byte(`<!DOCTYPE html>
<html>
<body>
<h1>Content</h1>
</body>
</html>`)

	upstream := mockNextHandler(testHTML, 200, http.Header{
		// Intentionally no Content-Type header
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Body is unchanged (no injection)
	body := rec.Body.Bytes()
	if !bytes.Equal(body, testHTML) {
		t.Error("Response without Content-Type should not be modified")
	}

	// ASSERT: No injection occurred
	if bytes.Contains(body, []byte("console.log('test');")) {
		t.Error("Script should not be injected when Content-Type is missing")
	}
}

// Test 22: Empty body should handle gracefully
func TestEmptyBodyHandling(t *testing.T) {
	// ARRANGE: HTML content-type with empty body
	emptyBody := []byte{}

	upstream := mockNextHandler(emptyBody, 200, http.Header{
		"Content-Type": []string{"text/html; charset=utf-8"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors (must handle gracefully without panic)
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Body remains empty (no </body> tag to inject before)
	body := rec.Body.Bytes()
	if len(body) != 0 {
		t.Errorf("Expected empty body to remain empty (no injection point), got %d bytes", len(body))
	}

	// ASSERT: Content-Length is correct
	contentLength := rec.Header().Get("Content-Length")
	if contentLength != "0" {
		t.Errorf("Expected Content-Length 0 for empty body, got %s", contentLength)
	}
}

// Test 23: Large HTML body should handle correctly
func TestLargeHTMLBodyHandling(t *testing.T) {
	// ARRANGE: Create a large HTML document (100KB+)
	var largeHTML bytes.Buffer
	largeHTML.WriteString(`<!DOCTYPE html>
<html>
<head><title>Large Document</title></head>
<body>
`)
	// Generate ~100KB of content
	for i := 0; i < 10000; i++ {
		largeHTML.WriteString(fmt.Sprintf("<p>Paragraph %d with some content to make it larger</p>\n", i))
	}
	largeHTML.WriteString(`</body>
</html>`)

	testHTML := largeHTML.Bytes()
	originalSize := len(testHTML)

	upstream := mockNextHandler(testHTML, 200, http.Header{
		"Content-Type": []string{"text/html; charset=utf-8"},
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('large document test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	// ACT
	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Injection occurred
	body := rec.Body.Bytes()
	if !bytes.Contains(body, []byte("console.log('large document test');")) {
		t.Error("Injection script not found in large HTML document")
	}

	// ASSERT: Injection is before </body>
	bodyCloseIndex := bytes.Index(body, []byte("</body>"))
	if bodyCloseIndex == -1 {
		t.Fatal("</body> tag not found in response")
	}

	injectionIndex := bytes.Index(body, []byte("console.log('large document test');"))
	if injectionIndex > bodyCloseIndex {
		t.Error("Injection appears after </body> tag in large document")
	}

	// ASSERT: Content-Length is updated correctly
	contentLength := rec.Header().Get("Content-Length")
	expectedLength := fmt.Sprintf("%d", len(body))
	if contentLength != expectedLength {
		t.Errorf("Content-Length mismatch: expected %s, got %s", expectedLength, contentLength)
	}

	// ASSERT: Body is larger than original
	if len(body) <= originalSize {
		t.Error("Injected body should be larger than original")
	}

	// Log performance info
	t.Logf("Original size: %d bytes, Injected size: %d bytes, Difference: %d bytes",
		originalSize, len(body), len(body)-originalSize)
}

// Test 24: 1xx and 3xx status codes (non-204, non-304) handling
func TestInformationalAndRedirectStatusCodes(t *testing.T) {
	testCases := []struct {
		name       string
		statusCode int
		shouldHaveBody bool
	}{
		{"100 Continue", 100, false},
		{"101 Switching Protocols", 101, false},
		{"301 Moved Permanently", 301, true},
		{"302 Found", 302, true},
		{"307 Temporary Redirect", 307, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// ARRANGE
			testHTML := []byte(`<!DOCTYPE html>
<html>
<body>
<h1>Redirect page</h1>
</body>
</html>`)

			headers := http.Header{
				"Content-Type": []string{"text/html; charset=utf-8"},
			}
			if tc.statusCode >= 300 && tc.statusCode < 400 {
				headers.Set("Location", "/new-location")
			}

			upstream := mockNextHandler(testHTML, tc.statusCode, headers)

			injector := &PluginInjector{
				InjectionScript: "console.log('test');",
			}

			ctx := createTestContext(t)
			if err := injector.Provision(ctx); err != nil {
				t.Fatalf("Failed to provision injector: %v", err)
			}

			req := httptest.NewRequest("GET", "/", nil)
			rec := httptest.NewRecorder()

			// ACT
			err := injector.ServeHTTP(rec, req, upstream)

			// ASSERT: No errors
			if err != nil {
				t.Fatalf("Handler returned error: %v", err)
			}

			// ASSERT: Status code is preserved
			if rec.Code != tc.statusCode {
				t.Errorf("Expected status %d, got %d", tc.statusCode, rec.Code)
			}

			// ASSERT: Body presence matches expectation
			body := rec.Body.Bytes()
			if tc.shouldHaveBody && len(body) == 0 {
				t.Errorf("Expected body for status %d, got empty", tc.statusCode)
			}
			if !tc.shouldHaveBody && len(body) != 0 {
				t.Errorf("Expected no body for status %d, got %d bytes", tc.statusCode, len(body))
			}
		})
	}
}

// Test 25: WebSocket upgrade request should bypass buffering
func TestWebSocketUpgradeBypass(t *testing.T) {
	// ARRANGE: Create a WebSocket upgrade request
	passedThroughDirectly := false

	upstream := caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
		// Check if we got the original ResponseWriter (not our responseRecorder)
		_, isRecorder := w.(*responseRecorder)
		passedThroughDirectly = !isRecorder

		// Simulate WebSocket upgrade response
		w.Header().Set("Upgrade", "websocket")
		w.Header().Set("Connection", "Upgrade")
		w.WriteHeader(101)
		return nil
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('should not inject');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	// ACT: Make WebSocket upgrade request
	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
	req.Header.Set("Sec-WebSocket-Version", "13")

	rec := httptest.NewRecorder()

	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Request was passed through directly (not buffered)
	if !passedThroughDirectly {
		t.Error("WebSocket upgrade request was buffered (should bypass buffering)")
	}

	// ASSERT: Response has upgrade headers
	if rec.Header().Get("Upgrade") != "websocket" {
		t.Error("Expected Upgrade header to be preserved")
	}

	// ASSERT: Status is 101 Switching Protocols
	if rec.Code != 101 {
		t.Errorf("Expected status 101, got %d", rec.Code)
	}
}

// Test 26: Connection upgrade header should bypass buffering
func TestConnectionUpgradeBypass(t *testing.T) {
	// ARRANGE: Request with Connection: upgrade header
	called := false
	directPassthrough := false

	upstream := caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
		called = true
		// Check if we got the original ResponseWriter (not buffered)
		_, isRecorder := w.(*responseRecorder)
		directPassthrough = !isRecorder

		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(200)
		w.Write([]byte("<html><body>Upgrade test</body></html>"))
		return nil
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	// ACT: Request with Connection: Upgrade header
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "h2c") // HTTP/2 cleartext upgrade

	rec := httptest.NewRecorder()

	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Upstream was called
	if !called {
		t.Error("Upstream handler was not called")
	}

	// ASSERT: Request was passed through directly (not buffered)
	if !directPassthrough {
		t.Error("Expected direct passthrough for upgrade request, but response was buffered")
	}
}

// Test 27: Regular request should still use buffering (not bypass)
func TestRegularRequestUsesBuffering(t *testing.T) {
	// ARRANGE: Normal HTML request without upgrade headers
	usedRecorder := false

	upstream := caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
		// Check if we got the responseRecorder (buffered)
		_, isRecorder := w.(*responseRecorder)
		usedRecorder = isRecorder

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(200)
		w.Write([]byte(`<!DOCTYPE html>
<html>
<body>
<h1>Normal request</h1>
</body>
</html>`))
		return nil
	})

	injector := &PluginInjector{
		InjectionScript: "console.log('test');",
	}

	ctx := createTestContext(t)
	if err := injector.Provision(ctx); err != nil {
		t.Fatalf("Failed to provision injector: %v", err)
	}

	// ACT: Normal GET request
	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()

	err := injector.ServeHTTP(rec, req, upstream)

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Handler returned error: %v", err)
	}

	// ASSERT: Recorder was used (response was buffered)
	if !usedRecorder {
		t.Error("Expected buffering for regular request, but got direct passthrough")
	}

	// ASSERT: Injection occurred
	body := rec.Body.Bytes()
	if !bytes.Contains(body, []byte("console.log('test');")) {
		t.Error("Injection script not found (buffering and injection should work for regular requests)")
	}
}

// Test 28: Hijacker interface implementation
func TestResponseRecorderHijacker(t *testing.T) {
	// ARRANGE: Create a mock ResponseWriter that supports hijacking
	mockConn := &mockNetConn{}
	mockRW := bufio.NewReadWriter(bufio.NewReader(mockConn), bufio.NewWriter(mockConn))

	mockWriter := &mockHijackableWriter{
		ResponseWriter: httptest.NewRecorder(),
		conn:          mockConn,
		rw:            mockRW,
	}

	rec := newResponseRecorder(mockWriter)

	// ACT: Attempt to hijack
	conn, rw, err := rec.Hijack()

	// ASSERT: No errors
	if err != nil {
		t.Fatalf("Hijack failed: %v", err)
	}

	// ASSERT: Got connection and bufio.ReadWriter
	if conn == nil {
		t.Error("Hijack returned nil connection")
	}
	if rw == nil {
		t.Error("Hijack returned nil ReadWriter")
	}

	// ASSERT: Got the expected mock connection
	if conn != mockConn {
		t.Error("Hijack returned wrong connection")
	}
}

// Test 29: Hijacker interface on non-hijackable ResponseWriter
func TestResponseRecorderHijackerNotSupported(t *testing.T) {
	// ARRANGE: Use standard httptest.ResponseRecorder which doesn't support hijacking
	rec := newResponseRecorder(httptest.NewRecorder())

	// ACT: Attempt to hijack
	conn, rw, err := rec.Hijack()

	// ASSERT: Error is returned
	if err == nil {
		t.Error("Expected error when hijacking non-hijackable ResponseWriter")
	}

	// ASSERT: Connection and ReadWriter are nil
	if conn != nil {
		t.Error("Expected nil connection when hijacking fails")
	}
	if rw != nil {
		t.Error("Expected nil ReadWriter when hijacking fails")
	}
}

// Test 30: Flusher interface implementation
func TestResponseRecorderFlusher(t *testing.T) {
	// ARRANGE: Create a mock ResponseWriter that supports flushing
	mockWriter := &mockFlushableWriter{
		ResponseWriter: httptest.NewRecorder(),
		flushed:       false,
	}

	rec := newResponseRecorder(mockWriter)

	// ACT: Call Flush
	rec.Flush()

	// ASSERT: Flush was called on underlying writer
	if !mockWriter.flushed {
		t.Error("Flush was not called on underlying ResponseWriter")
	}
}

// Test 31: Flusher interface on non-flushable ResponseWriter
func TestResponseRecorderFlusherNotSupported(t *testing.T) {
	// ARRANGE: Use a ResponseWriter that doesn't support flushing
	mockWriter := &mockNonFlushableWriter{
		ResponseWriter: httptest.NewRecorder(),
	}

	rec := newResponseRecorder(mockWriter)

	// ACT: Call Flush (should not panic)
	rec.Flush()

	// ASSERT: No panic occurred (test passes if we get here)
	t.Log("Flush handled gracefully on non-flushable ResponseWriter")
}

// Mock implementations for testing

// mockNetConn implements net.Conn for testing
type mockNetConn struct {
	net.Conn
}

func (m *mockNetConn) Read(b []byte) (n int, err error)   { return 0, nil }
func (m *mockNetConn) Write(b []byte) (n int, err error)  { return len(b), nil }
func (m *mockNetConn) Close() error                       { return nil }
func (m *mockNetConn) LocalAddr() net.Addr                { return nil }
func (m *mockNetConn) RemoteAddr() net.Addr               { return nil }

// mockHijackableWriter implements http.ResponseWriter and http.Hijacker
type mockHijackableWriter struct {
	http.ResponseWriter
	conn *mockNetConn
	rw   *bufio.ReadWriter
}

func (m *mockHijackableWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return m.conn, m.rw, nil
}

// mockFlushableWriter implements http.ResponseWriter and http.Flusher
type mockFlushableWriter struct {
	http.ResponseWriter
	flushed bool
}

func (m *mockFlushableWriter) Flush() {
	m.flushed = true
}

// mockNonFlushableWriter implements only http.ResponseWriter
type mockNonFlushableWriter struct {
	http.ResponseWriter
}
