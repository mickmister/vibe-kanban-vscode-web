# Phase 1 Implementation Plan - Test-Driven Development Approach

**Objective:** Build a working Caddy module that injects JavaScript into Vibe Kanban HTML responses using TDD methodology.

**Key Innovation:** Use Chrome DevTools MCP to capture real Vibe Kanban responses, serve them as test fixtures, and drive development with Go tests.

---

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Capture Real Vibe Kanban Responses](#step-1-capture-real-vibe-kanban-responses)
3. [Step 2: Create Test Fixture Server](#step-2-create-test-fixture-server)
4. [Step 3: Write Failing Tests](#step-3-write-failing-tests)
5. [Step 4: Implement Caddy Module](#step-4-implement-caddy-module)
6. [Step 5: Integrate and Validate](#step-5-integrate-and-validate)
7. [Success Criteria](#success-criteria)

---

## Overview

### Development Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Capture Real Responses (Chrome DevTools MCP)        │
│  - Navigate to http://127.0.0.1:59728                       │
│  - Save HTML, JS, CSS to files                              │
│  - Document response headers                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Create Test Fixture Server (Caddy)                  │
│  - Serve captured files as static assets                    │
│  - Route: /test-fixtures/original.html                      │
│  - Route: /test-fixtures/assets/*.js                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Write Failing Tests (TDD Red Phase)                 │
│  - Test: HTML injection works                               │
│  - Test: Content-Type preserved                             │
│  - Test: Doesn't break HTML structure                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Implement Module (TDD Green Phase)                  │
│  - Write minimal code to pass tests                         │
│  - Refactor and improve                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Integration Test (Real Vibe Kanban)                 │
│  - Run against http://127.0.0.1:59728                       │
│  - Verify with Chrome DevTools MCP                          │
│  - Validate all acceptance criteria                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Capture Real Vibe Kanban Responses

**Goal:** Learn exactly what Vibe Kanban returns so we can build accurate tests.

### Task 1.1: Navigate and Inspect with Chrome DevTools MCP

**Actions:**

1. Use `mcp__chrome-devtools__list_pages` to check available pages
2. Use `mcp__chrome-devtools__select_page` to select Vibe Kanban
3. Use `mcp__chrome-devtools__navigate_page` to go to `http://127.0.0.1:59728`
4. Use `mcp__chrome-devtools__take_snapshot` to capture page structure
5. Use `mcp__chrome-devtools__list_network_requests` to see all requests
6. Use `mcp__chrome-devtools__get_network_request` to inspect key requests

**Expected Output:**

```bash
vibe-kanban-caddy-module/test-fixtures/
├── captured/
│   ├── step1-page-snapshot.txt          # Initial page structure
│   ├── step1-network-requests.json      # All network calls
│   ├── step1-main-html-request.json     # The main HTML request details
│   └── step1-key-js-requests.json       # Important JS bundles
```

**Key Information to Extract:**

- HTML structure (where to inject script)
- Response headers (Content-Type, Content-Length, etc.)
- JavaScript bundle names (main.*.js, vendor.*.js)
- Script tag patterns (`<script type="module">`)
- CSS link patterns
- Any inline scripts

### Task 1.2: Download Response Bodies

**Actions:**

1. Parse network request data to get URLs
2. Use `curl` or `wget` to download actual response bodies
3. Save to files with descriptive names

**Commands:**

```bash
cd vibe-kanban-caddy-module/test-fixtures/captured

# Download main HTML (note: already running on 59728)
curl -H "Accept: text/html" http://127.0.0.1:59728/ > original.html

# Download main JS bundle (replace hash with actual from network requests)
curl http://127.0.0.1:59728/assets/main.*.js > main-bundle.js

# Download vendor JS
curl http://127.0.0.1:59728/assets/vendor.*.js > vendor-bundle.js

# Save response headers
curl -I http://127.0.0.1:59728/ > original-headers.txt
```

**Expected Output:**

```
test-fixtures/captured/
├── original.html                 # Main HTML response
├── original-headers.txt          # Response headers
├── main-bundle.js                # Primary JS bundle
├── vendor-bundle.js              # Vendor bundle (React, etc.)
└── styles.css                    # Main CSS (if separate)
```

### Task 1.3: Analyze Injection Points

**Actions:**

Create a document analyzing where to inject:

```bash
# Create analysis document
cat > test-fixtures/captured/injection-analysis.md << 'EOF'
# Vibe Kanban Injection Point Analysis

## HTML Structure

- Total size: X KB
- DOCTYPE: <!DOCTYPE html>
- Head section ends at: line X
- Body section starts at: line X
- Body section ends at: line X (</body> tag)

## Injection Targets

### Option 1: Before </head>
- Line number: X
- Context: Inside <head>, after all meta tags
- Pros: Loads early, can set up globals
- Cons: May delay page render

### Option 2: Before </body>
- Line number: X
- Context: After all content, before closing body tag
- Pros: Doesn't block rendering
- Cons: May load late (RECOMMENDED)

### Option 3: After opening <body>
- Line number: X
- Context: First element in body
- Pros: Runs before content loads
- Cons: Can delay initial render

## Script Tags Present

1. Type="module" scripts: X count
2. Inline scripts: X count
3. External scripts: X count
4. Async/defer attributes: [list]

## Recommended Strategy

Inject before `</body>` with this exact script:

```html
<script>
  console.log('[Caddy Plugin Injector] System active!');
  window.__CADDY_INJECTION_TEST__ = true;
</script>
```

## Content-Type Header

- Current: text/html; charset=utf-8
- Must preserve: Yes
- Compression: [gzip/br/none]

## Content-Length Handling

- Original: X bytes
- After injection: X + Y bytes
- Strategy: Recalculate and set new Content-Length
EOF
```

**Deliverable:** Documented injection strategy based on real HTML structure.

---

## Step 2: Create Test Fixture Server

**Goal:** Serve captured responses as static files for testing.

### Task 2.1: Organize Test Fixtures

**Directory Structure:**

```
vibe-kanban-caddy-module/
├── test-fixtures/
│   ├── captured/                 # Original responses from Step 1
│   │   ├── original.html
│   │   ├── main-bundle.js
│   │   └── vendor-bundle.js
│   ├── injection-scripts/        # JS files to inject
│   │   ├── phase1-test.js        # Simple test injection
│   │   └── plugin-system.js      # Future: full plugin system
│   ├── expected/                 # Expected outputs after injection
│   │   └── injected.html         # Created in Task 2.2
│   └── Caddyfile.test           # Test server config
```

### Task 2.2: Create Injection Script File

**Action:** Create the JavaScript file that will be injected.

**File:** `test-fixtures/injection-scripts/phase1-test.js`

```javascript
// Phase 1 Test Injection Script
// This script is injected by the Caddy module to verify injection works

console.log('[Caddy Plugin Injector] System active!');
window.__CADDY_INJECTION_TEST__ = true;

// Additional test helper
window.__CADDY_INJECTION_METADATA__ = {
  version: 'phase1',
  timestamp: Date.now(),
  injectedBy: 'vibe-kanban-plugin-injector'
};
```

**Commands:**

```bash
cd test-fixtures

# Create injection scripts directory
mkdir -p injection-scripts

# Create the injection script
cat > injection-scripts/phase1-test.js << 'EOF'
// Phase 1 Test Injection Script
// This script is injected by the Caddy module to verify injection works

console.log('[Caddy Plugin Injector] System active!');
window.__CADDY_INJECTION_TEST__ = true;

// Additional test helper
window.__CADDY_INJECTION_METADATA__ = {
  version: 'phase1',
  timestamp: Date.now(),
  injectedBy: 'vibe-kanban-plugin-injector'
};
EOF
```

### Task 2.3: Create Expected Output

**Action:** Manually inject script tag into captured HTML to create expected output.

```bash
cd test-fixtures

# Copy original
cp captured/original.html expected/injected.html

# Now we need to inject a <script> tag that loads our injection file
# The expected output should include:
#
# <script src="/test-fixtures/injection-scripts/phase1-test.js"></script>
# </body>
#
# OR for inline injection (which is what we'll actually do):
#
# <script>
# // Phase 1 Test Injection Script
# // This script is injected by the Caddy module to verify injection works
#
# console.log('[Caddy Plugin Injector] System active!');
# window.__CADDY_INJECTION_TEST__ = true;
#
# // Additional test helper
# window.__CADDY_INJECTION_METADATA__ = {
#   version: 'phase1',
#   timestamp: Date.now(),
#   injectedBy: 'vibe-kanban-plugin-injector'
# };
# </script>
# </body>
```

**Helper Script:**

Create a script to generate the expected output:

**File:** `test-fixtures/generate-expected.sh`

```bash
#!/bin/bash
# Generates expected HTML output with injection

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Read the injection script
INJECTION_SCRIPT=$(cat injection-scripts/phase1-test.js)

# Read the original HTML
ORIGINAL_HTML=$(cat captured/original.html)

# Find the </body> tag and inject script before it
# This uses sed to insert the script tag before </body>
cat captured/original.html | sed "/<\/body>/i\\
<script>\\
$INJECTION_SCRIPT\\
</script>" > expected/injected.html

echo "Generated expected/injected.html"
echo "Injection script size: $(wc -c < injection-scripts/phase1-test.js) bytes"
echo "Original HTML size: $(wc -c < captured/original.html) bytes"
echo "Injected HTML size: $(wc -c < expected/injected.html) bytes"
```

**Commands:**

```bash
cd test-fixtures

# Create the generation script
cat > generate-expected.sh << 'EOF'
[script contents from above]
EOF

chmod +x generate-expected.sh

# Run it to generate expected output
./generate-expected.sh
```

**Validation:**

```bash
# Verify injection was added
grep -n "Caddy Plugin Injector" expected/injected.html

# Verify closing body tag still present
grep -n "</body>" expected/injected.html

# Count line difference
wc -l captured/original.html expected/injected.html

# Verify the injected content matches the source file
diff -u <(cat injection-scripts/phase1-test.js) \
        <(sed -n '/<script>/,/<\/script>/p' expected/injected.html | sed '1d;$d')
```

### Task 2.4: Create Test Server Caddyfile

**File:** `test-fixtures/Caddyfile.test`

```caddyfile
# Test fixture server
# Serves captured responses for testing

{
    auto_https off
    admin off
}

:8080 {
    # Serve original (unmodified) responses
    handle /original/* {
        root * ./captured
        uri strip_prefix /original
        file_server
    }

    # Serve expected (injected) responses
    handle /expected/* {
        root * ./expected
        uri strip_prefix /expected
        file_server
    }

    # Serve injection scripts
    handle /injection-scripts/* {
        root * ./injection-scripts
        uri strip_prefix /injection-scripts
        file_server
        header Content-Type "application/javascript; charset=utf-8"
    }

    # Serve any fixture file directly
    handle /fixtures/* {
        root * ./
        uri strip_prefix /fixtures
        file_server
    }

    # Health check
    handle /health {
        respond "OK" 200
    }

    # 404 for everything else
    handle {
        respond "Test fixture not found" 404
    }
}
```

### Task 2.5: Start Test Fixture Server

**Commands:**

```bash
cd test-fixtures

# Start test server (use system caddy, not our module yet)
caddy run --config Caddyfile.test --adapter caddyfile

# In another terminal, test it works:
curl http://localhost:8080/health
# Expected: OK

curl http://localhost:8080/original/original.html | head -20
# Expected: First 20 lines of captured HTML

curl http://localhost:8080/expected/injected.html | grep "Caddy Plugin Injector"
# Expected: Should find the injected script

curl http://localhost:8080/injection-scripts/phase1-test.js
# Expected: Should return the JavaScript file contents
```

**Validation:**

- [ ] Server starts without errors
- [ ] `/health` returns 200 OK
- [ ] `/original/original.html` serves captured HTML
- [ ] `/expected/injected.html` serves modified HTML with inline script
- [ ] `/injection-scripts/phase1-test.js` serves JS file with correct Content-Type
- [ ] Injection content in expected output matches source JS file

**Deliverable:** Running test fixture server on port 8080.

---

## Step 3: Write Failing Tests (TDD Red Phase)

**Goal:** Write Go tests that define the expected behavior before implementing.

### Task 3.1: Set Up Go Test Infrastructure

**File:** `handler_test.go`

```go
package vibekanbanplugins

import (
    "bytes"
    "io"
    "net/http"
    "net/http/httptest"
    "os"
    "testing"

    "github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

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
```

### Task 3.2: Test 1 - HTML Injection Works

**Test:** Verify script is injected before `</body>`

```go
func TestInjectScriptIntoHTML(t *testing.T) {
    // ARRANGE: Load original HTML fixture
    originalHTML := loadFixture(t, "test-fixtures/captured/original.html")
    expectedHTML := loadFixture(t, "test-fixtures/expected/injected.html")

    // Create upstream handler that returns original HTML
    upstream := mockNextHandler(originalHTML, 200, http.Header{
        "Content-Type": []string{"text/html; charset=utf-8"},
    })

    // Create our injector handler
    injector := &PluginInjector{}

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
        // Optionally save diff for inspection
        os.WriteFile("test-fixtures/actual-output.html", body, 0644)
        t.Log("Actual output saved to test-fixtures/actual-output.html for inspection")
    }
}
```

**Expected Result:** Test FAILS (red) because `PluginInjector` is not implemented yet.

### Task 3.3: Test 2 - Only Injects HTML Responses

**Test:** Verify JavaScript responses are not modified.

```go
func TestDoesNotInjectJavaScript(t *testing.T) {
    // ARRANGE: Load JS fixture
    originalJS := loadFixture(t, "test-fixtures/captured/main-bundle.js")

    upstream := mockNextHandler(originalJS, 200, http.Header{
        "Content-Type": []string{"application/javascript; charset=utf-8"},
    })

    injector := &PluginInjector{}
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
```

**Expected Result:** Test FAILS (red).

### Task 3.4: Test 3 - Content-Length Updated

**Test:** Verify Content-Length header is recalculated.

```go
func TestUpdatesContentLength(t *testing.T) {
    // ARRANGE
    originalHTML := loadFixture(t, "test-fixtures/captured/original.html")

    upstream := mockNextHandler(originalHTML, 200, http.Header{
        "Content-Type":   []string{"text/html; charset=utf-8"},
        "Content-Length": []string{fmt.Sprintf("%d", len(originalHTML))},
    })

    injector := &PluginInjector{}
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
}
```

**Expected Result:** Test FAILS (red).

### Task 3.5: Test 4 - Handles Missing Body Tag

**Test:** Verify graceful handling when HTML is malformed.

```go
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

    injector := &PluginInjector{}
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
```

**Expected Result:** Test FAILS (red).

### Task 3.6: Run Tests and Verify Failures

**Commands:**

```bash
cd vibe-kanban-caddy-module

# Run all tests (should fail)
go test -v ./...

# Expected output:
# === RUN   TestInjectScriptIntoHTML
# --- FAIL: TestInjectScriptIntoHTML (0.00s)
#     handler_test.go:XX: Handler returned error: ...
# === RUN   TestDoesNotInjectJavaScript
# --- FAIL: TestDoesNotInjectJavaScript (0.00s)
# ...
# FAIL
```

**Validation:**

- [ ] All tests fail with clear error messages
- [ ] Fixtures load successfully
- [ ] Test infrastructure works (no compile errors)

**Deliverable:** Suite of failing tests that define desired behavior.

---

## Step 4: Implement Caddy Module (TDD Green Phase)

**Goal:** Write minimal code to make tests pass.

### Task 4.1: Create Module Skeleton

**File:** `handler.go`

```go
// Package vibekanbanplugins implements a Caddy HTTP handler that injects
// plugin system code into Vibe Kanban responses.
package vibekanbanplugins

import (
    "bytes"
    "fmt"
    "io"
    "net/http"
    "strconv"
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
    // Configuration fields (for future use)
    logger *zap.Logger
}

// CaddyModule returns the Caddy module information.
func (PluginInjector) CaddyModule() caddy.ModuleInfo {
    return caddy.ModuleInfo{
        ID:  "http.handlers.vibe_kanban_plugin_injector",
        New: func() caddy.Module { return new(PluginInjector) },
    }
}

// Provision implements caddy.Provisioner.
func (p *PluginInjector) Provision(ctx caddy.Context) error {
    p.logger = ctx.Logger(p)
    p.logger.Info("plugin injector provisioned")
    return nil
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (p *PluginInjector) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
    // Implementation will be added in Task 4.2
    return next.ServeHTTP(w, r)
}

// Interface guards
var (
    _ caddy.Provisioner           = (*PluginInjector)(nil)
    _ caddyhttp.MiddlewareHandler = (*PluginInjector)(nil)
)
```

**Validation:**

```bash
# Should compile
go build ./...

# Tests should still fail but with different errors
go test -v ./...
```

### Task 4.2: Implement Response Buffering

**Update:** `handler.go` - Add response recorder

```go
// responseRecorder buffers the response from upstream
type responseRecorder struct {
    http.ResponseWriter
    statusCode int
    body       *bytes.Buffer
    headers    http.Header
}

func newResponseRecorder(w http.ResponseWriter) *responseRecorder {
    return &responseRecorder{
        ResponseWriter: w,
        statusCode:     200,
        body:           new(bytes.Buffer),
        headers:        make(http.Header),
    }
}

func (r *responseRecorder) WriteHeader(statusCode int) {
    r.statusCode = statusCode
}

func (r *responseRecorder) Write(data []byte) (int, error) {
    return r.body.Write(data)
}

func (r *responseRecorder) Header() http.Header {
    return r.headers
}
```

**Update:** `ServeHTTP` to use recorder

```go
func (p *PluginInjector) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
    // Create recorder to buffer response
    rec := newResponseRecorder(w)

    // Call upstream handler
    err := next.ServeHTTP(rec, r)
    if err != nil {
        return err
    }

    // Process buffered response
    processedBody := p.processResponse(rec.headers, rec.body.Bytes())

    // Write final response
    for key, values := range rec.headers {
        for _, value := range values {
            w.Header().Add(key, value)
        }
    }

    // Update Content-Length
    w.Header().Set("Content-Length", strconv.Itoa(len(processedBody)))

    w.WriteHeader(rec.statusCode)
    w.Write(processedBody)

    return nil
}

// processResponse applies injection if appropriate
func (p *PluginInjector) processResponse(headers http.Header, body []byte) []byte {
    // Implementation will be added in Task 4.3
    return body
}
```

**Validation:**

```bash
go test -v ./...
# Tests should still fail but response buffering should work
```

### Task 4.3: Implement HTML Detection

**Update:** `processResponse` function

```go
func (p *PluginInjector) processResponse(headers http.Header, body []byte) []byte {
    // Only process HTML responses
    contentType := headers.Get("Content-Type")
    if !strings.HasPrefix(contentType, "text/html") {
        // Not HTML, return unchanged
        return body
    }

    // Inject into HTML
    return p.injectIntoHTML(body)
}

// injectIntoHTML adds our script before </body> tag
func (p *PluginInjector) injectIntoHTML(html []byte) []byte {
    // Implementation will be added in Task 4.4
    return html
}
```

**Validation:**

```bash
go test -v -run TestDoesNotInjectJavaScript
# This test should now PASS (green)
```

**Progress:** 1 test passing!

### Task 4.4: Implement HTML Injection

**Update:** `injectIntoHTML` function

```go
// Default injection script (loaded from file or embedded)
var defaultInjectionScript []byte

// init loads the default injection script
func init() {
    // Try to load from file first (for development)
    data, err := os.ReadFile("test-fixtures/injection-scripts/phase1-test.js")
    if err != nil {
        // Fall back to embedded version
        defaultInjectionScript = []byte(`// Phase 1 Test Injection Script
// This script is injected by the Caddy module to verify injection works

console.log('[Caddy Plugin Injector] System active!');
window.__CADDY_INJECTION_TEST__ = true;

// Additional test helper
window.__CADDY_INJECTION_METADATA__ = {
  version: 'phase1',
  timestamp: Date.now(),
  injectedBy: 'vibe-kanban-plugin-injector'
};`)
    } else {
        defaultInjectionScript = data
    }
}

func (p *PluginInjector) injectIntoHTML(html []byte) []byte {
    // Get the script content to inject
    scriptContent := p.InjectionScript
    if scriptContent == "" {
        scriptContent = string(defaultInjectionScript)
    }

    // Wrap in script tags
    injectionScript := fmt.Sprintf("<script>\n%s\n</script>\n", scriptContent)

    // Find </body> tag (case-insensitive)
    bodyCloseTag := []byte("</body>")
    bodyCloseIndex := bytes.Index(bytes.ToLower(html), bodyCloseTag)

    if bodyCloseIndex == -1 {
        // No </body> tag found, append to end
        p.logger.Warn("no </body> tag found, appending to end")
        return append(html, []byte(injectionScript)...)
    }

    // Inject before </body>
    var result bytes.Buffer
    result.Write(html[:bodyCloseIndex])
    result.WriteString(injectionScript)
    result.Write(html[bodyCloseIndex:])

    return result.Bytes()
}
```

**Validation:**

```bash
go test -v ./...
# Expected: More tests passing now
# - TestInjectScriptIntoHTML: PASS
# - TestDoesNotInjectJavaScript: PASS
# - TestUpdatesContentLength: PASS
# - TestHandlesMissingBodyTag: PASS (if implemented)
```

**Progress:** All tests should pass (green)!

### Task 4.5: Refactor and Clean Up

**Improvements:**

1. Add configuration options
2. Make injection script configurable
3. Add better logging
4. Handle edge cases

**Example configuration:**

```go
type PluginInjector struct {
    // InjectionScript is the JavaScript to inject
    InjectionScript string `json:"injection_script,omitempty"`

    logger *zap.Logger
}

func (p *PluginInjector) Provision(ctx caddy.Context) error {
    p.logger = ctx.Logger(p)

    // Default injection script if not configured
    if p.InjectionScript == "" {
        p.InjectionScript = injectionScript
    }

    p.logger.Info("plugin injector provisioned",
        zap.String("injection_size", fmt.Sprintf("%d bytes", len(p.InjectionScript))))

    return nil
}
```

**Validation:**

```bash
# Run tests again
go test -v ./...
# All tests should still pass

# Run linters
gofmt -d .
golint ./...
go vet ./...
```

---

## Step 5: Integrate and Validate

**Goal:** Test the module against real Vibe Kanban instance.

### Task 5.1: Create Integration Test Caddyfile

**File:** `Caddyfile.integration`

```caddyfile
{
    order vibe_kanban_plugin_injector before reverse_proxy
    admin off
}

:8081 {
    # Apply our injector
    vibe_kanban_plugin_injector

    # Proxy to real Vibe Kanban
    reverse_proxy http://127.0.0.1:59728 {
        # Disable compression so we can modify responses
        header_up -Accept-Encoding
    }
}
```

### Task 5.2: Build Caddy with Module

**Commands:**

```bash
cd vibe-kanban-caddy-module

# Build Caddy with our module
xcaddy build --with github.com/yourusername/vibe-kanban-plugins=.

# Verify it built
ls -lh ./caddy
./caddy version

# Should show our module in the list
./caddy list-modules | grep vibe_kanban
```

### Task 5.3: Start Integration Test Server

**Commands:**

```bash
# Start Caddy with integration config
./caddy run --config Caddyfile.integration --adapter caddyfile

# Server should start on :8081
# Logs should show:
# {"level":"info","msg":"plugin injector provisioned","injection_size":"XXX bytes"}
```

### Task 5.4: Test with Chrome DevTools MCP

**Actions:**

1. **Navigate to proxied instance:**
   ```
   Use mcp__chrome-devtools__navigate_page to http://127.0.0.1:8081
   ```

2. **Take snapshot:**
   ```
   Use mcp__chrome-devtools__take_snapshot
   Save to test-fixtures/integration/step5-injected-snapshot.txt
   ```

3. **Check console:**
   ```
   Use mcp__chrome-devtools__list_console_messages
   Look for "[Caddy Plugin Injector] System active!"
   ```

4. **Verify window global:**
   ```
   Use mcp__chrome-devtools__evaluate_script:
   Function: () => { return window.__CADDY_INJECTION_TEST__; }
   Should return: true
   ```

5. **Download modified HTML:**
   ```bash
   curl http://127.0.0.1:8081/ > test-fixtures/integration/proxied-response.html

   # Verify injection
   grep "Caddy Plugin Injector" test-fixtures/integration/proxied-response.html
   ```

6. **Compare with original:**
   ```bash
   diff -u test-fixtures/captured/original.html \
           test-fixtures/integration/proxied-response.html \
           > test-fixtures/integration/injection-diff.patch

   # Review the diff
   cat test-fixtures/integration/injection-diff.patch
   ```

### Task 5.5: Run Through Acceptance Criteria

**Reference:** `002-phase-1-acceptance-criteria.md`

Run through each criterion:

1. **[PASS] Caddy Module Compiles** - Done in Task 5.2
2. **[PASS] Docker Compose Stack** - Skip for now (integration test only)
3. **[PASS] Vibe Kanban Loads** - Test with Chrome MCP
4. **[PASS] Injection Logic Executes** - Verify console message
5. **[PASS] Functionality Intact** - Navigate through app
6. **[PASS] No Performance Degradation** - Measure response times
7. **[PASS] Error Handling** - Stop upstream, verify 502
8. **[PASS] Code Quality** - Run linters
9. **[PASS] Documentation** - Check comments
10. **[PASS] Reproducibility** - Fresh clone test

**Validation Commands:**

```bash
# Performance test
for i in {1..100}; do
  curl -w "%{time_total}\n" -o /dev/null -s http://127.0.0.1:8081/
done | awk '{ total += $1; count++ } END { print "Average:", total/count, "seconds" }'

# Should be < 0.2 seconds average

# Error handling test
# Stop Vibe Kanban at 59728 (if in docker, stop container)
curl -I http://127.0.0.1:8081/
# Should get 502 Bad Gateway

# Code quality
gofmt -d . > test-fixtures/integration/gofmt-output.txt
golint ./... > test-fixtures/integration/golint-output.txt
go vet ./... 2>&1 | tee test-fixtures/integration/govet-output.txt

# Should all be clean
```

### Task 5.6: Document Results

**File:** `test-fixtures/integration/test-results.md`

```markdown
# Phase 1 Integration Test Results

**Date:** [Date]
**Tester:** [Name]

## Test Environment

- Caddy version: [version]
- Go version: [version]
- Vibe Kanban endpoint: http://127.0.0.1:59728
- Proxy endpoint: http://127.0.0.1:8081

## Test Results

### [PASS] 1. Caddy Module Compiles
- Build time: X seconds
- Binary size: X MB
- No warnings or errors

### [PASS] 2. Integration Server Starts
- Started successfully on :8081
- Logs show module loaded
- No startup errors

### [PASS] 3. Vibe Kanban Loads Through Proxy
- HTTP 200 response
- HTML rendered correctly
- All assets loaded

### [PASS] 4. Injection Verified
- Console message appears: "[Caddy Plugin Injector] System active!"
- window.__CADDY_INJECTION_TEST__ = true
- Script appears before </body> tag

### [PASS] 5. Functionality Intact
- Navigation works
- API calls succeed
- No JavaScript errors
- Full interactivity preserved

### [PASS] 6. Performance
- Average response time: X ms
- Overhead: X ms (< 50ms threshold)
- No memory leaks observed

### [PASS] 7. Error Handling
- Returns 502 when upstream down
- No Caddy crashes
- Proper error logging

### [PASS] 8. Code Quality
- gofmt: clean
- golint: no warnings
- go vet: no issues

## Screenshots

- Console: test-fixtures/integration/console-screenshot.png
- Injected HTML: test-fixtures/integration/html-source.png

## Issues Found

[None / List any issues]

## Conclusion

Phase 1 implementation COMPLETE. All acceptance criteria met.
```

---

## Success Criteria

### All Tests Pass

```bash
go test -v ./...
# === RUN   TestInjectScriptIntoHTML
# --- PASS: TestInjectScriptIntoHTML (0.00s)
# === RUN   TestDoesNotInjectJavaScript
# --- PASS: TestDoesNotInjectJavaScript (0.00s)
# === RUN   TestUpdatesContentLength
# --- PASS: TestUpdatesContentLength (0.00s)
# === RUN   TestHandlesMissingBodyTag
# --- PASS: TestHandlesMissingBodyTag (0.00s)
# PASS
# ok      github.com/yourusername/vibe-kanban-plugins
```

### Integration Works

- [ ] Console shows injection message
- [ ] `window.__CADDY_INJECTION_TEST__ === true`
- [ ] Vibe Kanban fully functional
- [ ] No errors in browser console
- [ ] Performance within limits

### Code Quality

- [ ] All linters pass
- [ ] Code coverage > 80%
- [ ] Documentation complete
- [ ] No TODOs remaining

### Deliverables

```
vibe-kanban-caddy-module/
├── handler.go                  # Main implementation
├── handler_test.go             # Unit tests
├── go.mod                      # Dependencies
├── go.sum                      # Checksums
├── main.go                     # Caddy module registration
├── Caddyfile.integration       # Integration test config
├── test-fixtures/
│   ├── captured/               # Real responses from Step 1
│   │   ├── original.html
│   │   ├── main-bundle.js
│   │   └── vendor-bundle.js
│   ├── injection-scripts/      # JS files to inject
│   │   ├── phase1-test.js      # Test injection script
│   │   └── plugin-system.js    # Future: full plugin system
│   ├── expected/               # Expected outputs after injection
│   │   └── injected.html       # Generated by generate-expected.sh
│   ├── integration/            # Integration test results
│   ├── Caddyfile.test         # Test fixture server config
│   ├── generate-expected.sh    # Script to create expected outputs
│   └── actual-output.html      # Test output (gitignored)
└── notes/
    ├── 001-plugin-system-analysis.md
    ├── 002-phase-1-acceptance-criteria.md
    └── 003-phase-1-implementation-plan.md  # This document
```

---

## TDD Workflow Summary

```
Step 1: Capture (Chrome DevTools MCP)
    ↓
Step 2: Fixtures (Static server + JS files)
    ↓
    Create injection-scripts/*.js
    ↓
    Generate expected outputs from scripts
    ↓
Step 3: Red (Write failing tests)
    ↓
    Tests load JS from files
    ↓
    Compare against snapshots
    ↓
Step 4: Green (Implement to pass)
    ↓
    Handler loads JS from files
    ↓
    Refactor (Clean up code)
    ↓
Step 5: Validate (Integration test)
    ↓
DONE!
```

### Key Testing Principle: Snapshot-Based Testing

**Philosophy:** Given this input, we get this output.

**Implementation:**
1. **Input:** `test-fixtures/captured/original.html` (real Vibe Kanban response)
2. **Injection:** `test-fixtures/injection-scripts/phase1-test.js` (actual JS file)
3. **Expected Output:** `test-fixtures/expected/injected.html` (snapshot)
4. **Actual Output:** Result from running handler (compared against snapshot)

**Benefits:**
- JS code is in actual `.js` files (syntax highlighting, linting works)
- Expected outputs are generated from source JS files (single source of truth)
- Tests verify exact transformation: `original.html + phase1-test.js = injected.html`
- Easy to update: change JS file, regenerate expected output
- Future-proof: same pattern for plugin-system.js in Phase 2

**Example Test Pattern:**

```go
func TestInjectScriptIntoHTML(t *testing.T) {
    // Load input
    originalHTML := loadFixture(t, "test-fixtures/captured/original.html")

    // Load injection script (actual JS file)
    injectionJS := loadFixture(t, "test-fixtures/injection-scripts/phase1-test.js")

    // Load expected snapshot
    expectedHTML := loadFixture(t, "test-fixtures/expected/injected.html")

    // Run handler
    actualHTML := runInjector(originalHTML)

    // Verify transformation
    if !bytes.Equal(actualHTML, expectedHTML) {
        t.Error("Output doesn't match snapshot")
        // Save actual for inspection
        os.WriteFile("test-fixtures/actual-output.html", actualHTML, 0644)
    }

    // Verify injection contains our script
    if !bytes.Contains(actualHTML, injectionJS) {
        t.Error("Injected HTML doesn't contain expected JS")
    }
}
```

**Recommended .gitignore:**

```gitignore
# Test outputs (actual results, not snapshots)
test-fixtures/actual-output.html
test-fixtures/actual-*.html
test-fixtures/actual-*.js

# Integration test results
test-fixtures/integration/*.har
test-fixtures/integration/*.png
test-fixtures/integration/*.log
test-fixtures/integration/*.txt

# But keep example/expected files
!test-fixtures/expected/
!test-fixtures/captured/
!test-fixtures/injection-scripts/
```

**Estimated Time:**
- Step 1: 30 minutes (capture and analyze)
- Step 2: 30 minutes (set up fixtures + JS files + generation script)
- Step 3: 40 minutes (write tests with file loading)
- Step 4: 60 minutes (implement with file loading and refactor)
- Step 5: 30 minutes (integration and validation)

**Total: ~3 hours** (matches Phase 1 estimate)

---

## Next Steps After Phase 1

Once Phase 1 is complete:

1. Commit all code to git
2. Tag release `v0.1.0-phase1`
3. Update `002-phase-1-acceptance-criteria.md` with results
4. Create `004-phase-2-implementation-plan.md`
5. Begin extracting plugin system code from vibe-kanban branch

**Phase 2 Preview:** Inject actual plugin system (not just test script).
