# Phase 1: Proof of Concept - Acceptance Criteria

**Phase Goal:** Prove that Caddy can intercept and modify Vibe Kanban responses without breaking the application.

**Estimated Time:** 2-3 hours

---

## Acceptance Rubric

### [PASS] 1. Caddy Module Compiles Successfully

**Validation Steps:**
```bash
cd vibe-kanban-caddy-module
go mod tidy
xcaddy build --with github.com/yourusername/vibe-kanban-plugins=.
```

**Success Criteria:**
- [ ] `go mod tidy` completes without errors
- [ ] `xcaddy build` produces a `caddy` binary
- [ ] No compilation warnings or errors
- [ ] Binary size is reasonable (50-100MB)

**Evidence to Capture:**
```bash
# Save build output
xcaddy build --with github.com/yourusername/vibe-kanban-plugins=. 2>&1 | tee notes/phase1-build-output.txt

# Verify binary
ls -lh ./caddy
./caddy version
```

**Failure Modes to Check:**
- Missing Go dependencies
- Import path issues
- Module registration errors
- Interface implementation mismatches

---

### [PASS] 2. Docker Compose Stack Starts Successfully

**Validation Steps:**
```bash
docker-compose up --build
```

**Success Criteria:**
- [ ] All 3 containers build without errors:
  - `caddy` (with custom module)
  - `vibe-kanban` (npx runner)
  - (plugin-builder can be added in Phase 2)
- [ ] All containers reach healthy/running state
- [ ] No container crashes or restarts
- [ ] Logs show successful initialization

**Evidence to Capture:**
```bash
# Container status
docker-compose ps > notes/phase1-container-status.txt

# Logs from each service
docker-compose logs caddy > notes/phase1-caddy-logs.txt
docker-compose logs vibe-kanban > notes/phase1-vibe-logs.txt
```

**Expected Log Patterns:**

**Caddy logs should show:**
```
{"level":"info","msg":"using provided configuration","config_file":"/etc/caddy/Caddyfile"}
{"level":"info","msg":"autosaved config","file":"/config/caddy/autosave.json"}
{"level":"info","msg":"serving initial configuration"}
{"level":"info","msg":"vibe_kanban_plugin_injector module loaded"}
```

**Vibe Kanban logs should show:**
```
Starting Vibe Kanban...
Server running on http://localhost:3000
```

**Failure Modes to Check:**
- Port conflicts (3000, 80, 443)
- Volume mount issues
- Network connectivity between containers
- Missing environment variables

---

### [PASS] 3. Vibe Kanban Loads Through Caddy Proxy

**Validation Steps:**
```bash
# From host machine
curl -I http://localhost/

# From browser
open http://localhost/
```

**Success Criteria:**
- [ ] HTTP 200 response from `curl`
- [ ] HTML response contains Vibe Kanban content
- [ ] Browser shows Vibe Kanban UI
- [ ] No 502 Bad Gateway errors
- [ ] No CORS errors in browser console
- [ ] All assets load (JS, CSS, images)

**Evidence to Capture:**
```bash
# Full HTML response
curl http://localhost/ > notes/phase1-original-html.html

# Response headers
curl -I http://localhost/ > notes/phase1-response-headers.txt

# Browser console screenshot
# Save as notes/phase1-browser-console.png
```

**Things to Verify in Browser:**
- Vibe Kanban logo appears
- Navigation works
- No network errors in DevTools Network tab
- No JavaScript errors in Console tab
- Page is fully interactive

**Failure Modes to Check:**
- Reverse proxy misconfiguration
- Missing headers (CORS, Content-Type)
- Compression issues
- WebSocket connection failures (if Vibe uses them)

---

### [PASS] 4. Injection Logic Executes

**Validation Steps:**

Open browser console and check for injected message:
```javascript
// Should see in console:
"[Caddy Plugin Injector] System active!"
```

**Success Criteria:**
- [ ] Console message appears on page load
- [ ] Message appears before other Vibe Kanban logs
- [ ] Injection happens on every page (/, /projects, /tasks)
- [ ] Injection doesn't interfere with Vibe Kanban functionality

**Evidence to Capture:**
```bash
# Check HTML source for injected script
curl http://localhost/ | grep -A 5 "Caddy Plugin Injector"

# Save modified HTML
curl http://localhost/ > notes/phase1-modified-html.html

# Screenshot of browser console
# Save as notes/phase1-injection-proof.png
```

**Expected HTML Modification:**

**Before injection (from upstream):**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Vibe Kanban</title>
  </head>
  <body>
    <!-- Vibe Kanban content -->
  </body>
</html>
```

**After injection (from Caddy):**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Vibe Kanban</title>
  </head>
  <body>
    <!-- Vibe Kanban content -->
    <script>
      console.log('[Caddy Plugin Injector] System active!');
      window.__CADDY_INJECTION_TEST__ = true;
    </script>
  </body>
</html>
```

**Failure Modes to Check:**
- Injection happens at wrong location
- Double injection (appears twice)
- Breaks HTML structure (unclosed tags)
- Doesn't inject on all pages

---

### [PASS] 5. Vibe Kanban Functionality Remains Intact

**Validation Steps:**

Test core Vibe Kanban features through the proxy:

1. **Navigation:**
   - [ ] Home page loads
   - [ ] Click "Projects" → page navigates
   - [ ] Click "Tasks" → page navigates
   - [ ] Browser back button works

2. **Authentication (if applicable):**
   - [ ] Login flow works
   - [ ] Session persists
   - [ ] Logout works

3. **API Calls:**
   - [ ] Open DevTools Network tab
   - [ ] Perform actions (create task, etc.)
   - [ ] Verify API calls succeed (200/201 responses)

4. **Real-time Features:**
   - [ ] Task updates appear
   - [ ] Live data refreshes work

**Evidence to Capture:**
```bash
# Network trace
# In browser DevTools > Network > Export HAR
# Save as notes/phase1-network-trace.har

# Screenshot of working UI
# Save as notes/phase1-ui-working.png
```

**Failure Modes to Check:**
- Broken API calls (wrong Content-Type headers)
- Authentication cookies not forwarded
- WebSocket connections fail
- State management breaks
- Real-time updates stop working

---

### [PASS] 6. No Performance Degradation

**Validation Steps:**

**Measure baseline (direct to Vibe Kanban):**
```bash
# Connect directly to Vibe Kanban container
docker exec -it <vibe-container> sh
apk add curl

# Time direct request
time curl http://localhost:3000/ > /dev/null
```

**Measure through Caddy:**
```bash
# From host
time curl http://localhost/ > /dev/null
```

**Success Criteria:**
- [ ] Caddy adds < 50ms overhead per request
- [ ] No memory leaks in Caddy container
- [ ] Response times are consistent
- [ ] Large files don't cause timeouts

**Evidence to Capture:**
```bash
# Run 100 requests and measure
for i in {1..100}; do
  curl -w "%{time_total}\n" -o /dev/null -s http://localhost/
done > notes/phase1-response-times.txt

# Calculate average
awk '{ total += $1; count++ } END { print total/count }' notes/phase1-response-times.txt

# Monitor container resources
docker stats --no-stream > notes/phase1-container-resources.txt
```

**Acceptable Performance:**
- Average response time: < 200ms
- P95 response time: < 500ms
- Caddy memory usage: < 100MB
- No CPU spikes > 50%

**Failure Modes to Check:**
- Memory leaks from buffering responses
- CPU spikes from regex/string operations
- Slow response times from inefficient injection
- Container OOM (Out of Memory) kills

---

### [PASS] 7. Error Handling Works

**Validation Steps:**

Test failure scenarios:

1. **Stop Vibe Kanban container:**
   ```bash
   docker-compose stop vibe-kanban
   curl http://localhost/
   ```
   - [ ] Should get 502 Bad Gateway (not 500 or crash)

2. **Corrupt injection logic:**
   - Temporarily break handler code
   - [ ] Should fail gracefully or skip injection

3. **Invalid HTML from upstream:**
   - Mock broken HTML response
   - [ ] Should not crash Caddy

**Success Criteria:**
- [ ] Caddy stays running when upstream fails
- [ ] Proper error codes returned (502, not 500)
- [ ] Errors logged clearly
- [ ] No panic/crash in Go code

**Evidence to Capture:**
```bash
# Test error conditions
docker-compose stop vibe-kanban
curl -I http://localhost/ > notes/phase1-error-response.txt
docker-compose logs caddy --tail=50 > notes/phase1-error-logs.txt

# Restart and verify recovery
docker-compose start vibe-kanban
sleep 5
curl -I http://localhost/ > notes/phase1-recovery-response.txt
```

**Expected Error Logs:**
```
{"level":"error","msg":"upstream connection failed","upstream":"http://vibe-kanban:3000"}
```

**Failure Modes to Check:**
- Caddy crashes on upstream failure
- No error logging
- Confusing error messages
- Infinite retry loops

---

### [PASS] 8. Code Quality & Maintainability

**Code Review Checklist:**

**Go Code (`handler.go`):**
- [ ] Follows Go best practices (gofmt, golint)
- [ ] Has package documentation
- [ ] Functions have doc comments
- [ ] Error handling is explicit (no `panic()`)
- [ ] Uses structured logging
- [ ] Constants are named and documented
- [ ] No hardcoded strings (use config)

**Configuration (`Caddyfile`):**
- [ ] Well-commented
- [ ] Uses environment variables for hosts/ports
- [ ] Order directives are explicit
- [ ] Route patterns are clear

**Docker Setup:**
- [ ] Dockerfile uses multi-stage builds
- [ ] Images are reasonably sized
- [ ] No secrets in images
- [ ] docker-compose.yml is well-documented
- [ ] Health checks defined

**Evidence to Capture:**
```bash
# Run linters
gofmt -d . > notes/phase1-gofmt-diff.txt
golint ./... > notes/phase1-golint.txt
go vet ./... 2>&1 | tee notes/phase1-govet.txt

# Count lines of code
cloc --by-file . > notes/phase1-loc.txt
```

**Success Criteria:**
- [ ] `gofmt -d .` returns empty (code is formatted)
- [ ] `golint` has no warnings
- [ ] `go vet` has no issues
- [ ] Total Go code < 500 lines (Phase 1 should be simple)

**Failure Modes to Check:**
- Unformatted code
- Missing error checks
- Unclear variable names
- No comments on exported functions

---

### [PASS] 9. Documentation Exists

**Required Documentation:**

1. **README.md** (in vibe-kanban-caddy-module/)
   - [ ] Describes what the project does
   - [ ] Has quick start instructions
   - [ ] Lists prerequisites
   - [ ] Shows how to build and run

2. **Code Comments**
   - [ ] Package-level doc comment
   - [ ] All exported functions documented
   - [ ] Complex logic has inline comments
   - [ ] TODOs for future phases marked

3. **Phase 1 Completion Notes**
   - [ ] This acceptance criteria document completed
   - [ ] Test results captured in notes/
   - [ ] Screenshots saved
   - [ ] Known issues documented

**Evidence to Capture:**
```bash
# Generate godoc
godoc -http=:6060 &
# Visit http://localhost:6060/pkg/your-module/
# Screenshot and save as notes/phase1-godoc.png

# Check documentation coverage
go doc -all > notes/phase1-godoc.txt
```

**Success Criteria:**
- [ ] README has all sections filled
- [ ] Every exported type/function has doc comment
- [ ] Documentation renders correctly in godoc
- [ ] No broken links or references

---

### [PASS] 10. Reproducibility

**Validation Steps:**

Test that a fresh developer can reproduce the setup:

1. **Clone repository:**
   ```bash
   git clone <repo-url> test-clone
   cd test-clone/vibe-kanban-caddy-module
   ```

2. **Follow README instructions:**
   ```bash
   # Exactly as written in README
   docker-compose up --build
   ```

3. **Verify all acceptance criteria:**
   - Run through criteria 1-9 again
   - Document any missing steps

**Success Criteria:**
- [ ] README instructions are complete
- [ ] No manual steps needed beyond README
- [ ] No "it works on my machine" issues
- [ ] Build succeeds on fresh checkout
- [ ] All dependencies automatically installed

**Evidence to Capture:**
```bash
# Test in clean environment
docker run --rm -v $(pwd):/workspace -w /workspace golang:1.21 \
  sh -c "go mod download && xcaddy build"

# Verify docker-compose works standalone
docker-compose down -v
docker-compose up --build > notes/phase1-fresh-build.log 2>&1
```

**Failure Modes to Check:**
- Missing prerequisites in docs
- Hardcoded paths (only work on dev machine)
- External dependencies not specified
- Environment variables not documented

---

## Overall Phase 1 Success Criteria

**All of the following must be true:**

- [PASS] Caddy module compiles without errors
- [PASS] Docker Compose stack runs all containers
- [PASS] Vibe Kanban is accessible through Caddy proxy
- [PASS] Console message proves injection works
- [PASS] Vibe Kanban functionality is unaffected
- [PASS] Performance overhead is acceptable (< 50ms)
- [PASS] Error handling works gracefully
- [PASS] Code passes linting and vet checks
- [PASS] Documentation is complete
- [PASS] Setup is reproducible from README

**Deliverables Checklist:**

```
vibe-kanban-caddy-module/
├── README.md                           [DONE] Complete quick start guide
├── go.mod                              [DONE] Dependencies declared
├── go.sum                              [DONE] Checksums locked
├── main.go                             [DONE] Caddy module registration
├── handler.go                          [DONE] HTTP handler with injection
├── Dockerfile.caddy                    [DONE] Builds Caddy with module
├── docker-compose.yml                  [DONE] 2-container setup (Caddy + Vibe)
├── Caddyfile                           [DONE] Proxy + injection config
└── notes/
    ├── 001-plugin-system-analysis.md   [DONE] Architecture design
    ├── 002-phase-1-acceptance-criteria.md  [DONE] This document
    ├── phase1-build-output.txt         [DONE] Build logs
    ├── phase1-container-status.txt     [DONE] Docker ps output
    ├── phase1-caddy-logs.txt           [DONE] Caddy runtime logs
    ├── phase1-original-html.html       [DONE] Unmodified response
    ├── phase1-modified-html.html       [DONE] After injection
    ├── phase1-injection-proof.png      [DONE] Browser console screenshot
    ├── phase1-response-times.txt       [DONE] Performance data
    ├── phase1-gofmt-diff.txt           [DONE] Code formatting check
    └── phase1-golint.txt               [DONE] Linter output
```

---

## Red Flags (Phase 1 Failure Indicators)

**Stop and debug if any of these occur:**

[FAIL] **Caddy crashes on startup**
- Root cause: Module registration error
- Action: Check `CaddyModule()` implementation

[FAIL] **Vibe Kanban shows blank page through proxy**
- Root cause: Headers or content-type issues
- Action: Compare direct vs proxied responses

[FAIL] **Injection appears but breaks page layout**
- Root cause: Invalid HTML injection point
- Action: Use browser DevTools to inspect DOM

[FAIL] **Performance > 100ms overhead**
- Root cause: Inefficient buffering or regex
- Action: Profile Go code, check buffer sizes

[FAIL] **Cannot reproduce on fresh clone**
- Root cause: Undocumented dependencies or steps
- Action: Update README, add to docker-compose

---

## Transition to Phase 2

**Before starting Phase 2, ensure:**

- [ ] All Phase 1 acceptance criteria are met
- [ ] All deliverables are committed to git
- [ ] All evidence files are in notes/ directory
- [ ] README accurately reflects current state
- [ ] No known critical bugs
- [ ] Team review completed (if applicable)

**Phase 1 → Phase 2 Handoff Checklist:**

- [ ] Basic injection works reliably
- [ ] Infrastructure is stable
- [ ] Build process is documented
- [ ] Ready to add plugin system code
- [ ] Performance baseline established
- [ ] Error handling patterns proven

**Sign-off:**

```
Phase 1 Completed: [Date]
Completed by: [Name]
Review by: [Name] (optional)

Notes:
- What went well:
- What was challenging:
- Lessons learned:
- Recommendations for Phase 2:
```

---

## Quick Self-Assessment

Run this checklist in 5 minutes to verify Phase 1 completion:

```bash
# 1. Build works
xcaddy build --with github.com/yourusername/vibe-kanban-plugins=. && echo "[PASS] Build OK" || echo "[FAIL] Build FAILED"

# 2. Stack starts
docker-compose up -d && sleep 10 && docker-compose ps | grep "Up" && echo "[PASS] Containers OK" || echo "[FAIL] Containers FAILED"

# 3. Proxy works
curl -s http://localhost/ | grep -q "Vibe Kanban" && echo "[PASS] Proxy OK" || echo "[FAIL] Proxy FAILED"

# 4. Injection works
curl -s http://localhost/ | grep -q "Caddy Plugin Injector" && echo "[PASS] Injection OK" || echo "[FAIL] Injection FAILED"

# 5. Code quality
gofmt -l . | wc -l | xargs test 0 -eq && echo "[PASS] Format OK" || echo "[FAIL] Format FAILED"

# 6. Docs exist
test -f README.md && echo "[PASS] README OK" || echo "[FAIL] README MISSING"

# Cleanup
docker-compose down
```

**All [PASS] = Phase 1 Complete!**

**Any [FAIL] = Fix before proceeding to Phase 2**
