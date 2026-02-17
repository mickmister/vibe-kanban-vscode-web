# Vibe Kanban Caddy Plugin System - Design Document

**Date:** 2026-01-01
**Purpose:** MITM-based plugin system using Caddy reverse proxy for runtime JS injection

---

## Executive Summary

This document outlines the architecture for a **Caddy-based plugin system** that enables extending the production Vibe Kanban application without recompilation. By intercepting HTTP responses and injecting JavaScript, we can add a plugin system to any version of Vibe Kanban running via `npx`.

### Key Innovation

Instead of forking and maintaining Vibe Kanban with plugin support compiled in, we:
1. Run production Vibe Kanban (via `npx @vibe-kanban/cli`)
2. Intercept responses using Caddy reverse proxy
3. Inject plugin system hooks into JavaScript files
4. Add `<script>` tags to HTML to load custom plugins
5. Never touch the actual Vibe Kanban source code

---

## Table of Contents

1. [Current Plugin System Analysis](#current-plugin-system-analysis)
2. [Caddy Module Research](#caddy-module-research)
3. [Architecture Design](#architecture-design)
4. [Code Extraction Plan](#code-extraction-plan)
5. [Implementation Phases](#implementation-phases)
6. [Docker Compose Setup](#docker-compose-setup)
7. [Next Steps](#next-steps)

---

## Current Plugin System Analysis

### What Exists in vibe-kanban Branch

The `vk/344f-caddy-module-tha` branch contains a **fully functional plugin system** with:

#### Plugin Infrastructure Files

Located in `plugins/` directory:
- **`plugins/README.md`** - Complete plugin development guide
- **`plugins/vscode-embed/`** - Working VS Code integration plugin
- **`plugins/example-plugin/`** - Template for new plugins
- **`plugins/ui/`** - Placeholder for UI-only plugins

#### Frontend Integration

**Plugin API (`frontend/src/lib/plugin-api.ts`)**:
```typescript
export interface PluginAPI {
  registerTaskAttemptViewTab(registration: TaskAttemptViewTabRegistration): void;
  registerDashboardComponent(registration: DashboardComponentRegistration): void;
}

export interface TaskAttemptViewTabProps {
  taskAttemptId: string;
  taskId: string;
  projectId: string;
}
```

**Plugin Host (`frontend/src/lib/plugin-host.tsx`)**:
- Creates React Context for plugin registry
- Provides hooks: `usePlugins()`, `useTaskAttemptViewTabs()`, `useDashboardComponents()`
- Initializes plugins on app mount
- Validates and registers plugin components

**Plugin Loader (`frontend/src/lib/plugin-loader.ts`)**:
- Fetches `/api/plugins/manifest.json`
- Dynamically imports plugin bundles: `/api/plugins/{id}/bundle.js`
- Handles errors gracefully (individual plugin failures don't crash app)

**UI Integration (`frontend/src/components/panels/TaskAttemptTabs.tsx`)**:
```typescript
export function TaskAttemptTabs({ attempt, task }: TaskAttemptTabsProps) {
  const pluginTabs = useTaskAttemptViewTabs();

  return (
    <Tabs>
      {/* Built-in tabs */}
      <TabsTrigger value="logs">Logs</TabsTrigger>

      {/* Plugin tabs */}
      {pluginTabs.map((tab) => (
        <TabsTrigger key={tab.id} value={tab.id}>
          {tab.label}
        </TabsTrigger>
      ))}

      {/* Tab content */}
      {pluginTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          <tab.component {...props} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

**App Initialization (`frontend/src/App.tsx`)**:
- Wraps entire app in `<PluginProvider>` (line ~171)
- Plugins initialize before rendering main content

#### Backend Support

**Plugin Bundler (`crates/services/src/services/plugin_bundler.rs`)**:
- Discovers plugins from `plugins/` directory at startup
- Generates manifest with plugin metadata
- Expects pre-built `dist/plugin.js` for each plugin

**API Routes (`crates/server/src/routes/plugins.rs`)**:
- `GET /api/plugins/manifest.json` - Returns plugin list
- `GET /api/plugins/:id/bundle.js` - Serves plugin JavaScript
- Caching: `Cache-Control: public, max-age=3600`

**Server Initialization (`crates/local-deployment/src/lib.rs`)**:
- Plugin bundler initialized at server startup (lines 188-206)
- Failures don't crash server (graceful degradation)

### Plugin Build System

Each plugin is a **standalone Vite project**:

**`plugins/vscode-embed/package.json`**:
```json
{
  "name": "vscode-embed",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

**`plugins/vscode-embed/vite.config.ts`**:
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src.tsx',
      formats: ['es'],
      fileName: 'plugin',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
    outDir: 'dist',
  },
});
```

**Plugin Source (`plugins/vscode-embed/src.tsx`)**:
```typescript
import type { PluginAPI, TaskAttemptViewTabProps } from '../../frontend/src/lib/plugin-api';
import { useTaskAttempt } from '../../frontend/src/hooks/useTaskAttempt';

function VSCodeEditorTab({ taskAttemptId }: TaskAttemptViewTabProps) {
  const { data: attempt } = useTaskAttempt(taskAttemptId);
  const [iframeUrl, setIframeUrl] = useState<string>('');

  useEffect(() => {
    if (attempt?.container_ref) {
      const url = `http://localhost:3001/?folder=${encodeURIComponent(attempt.container_ref)}`;
      setIframeUrl(url);
    }
  }, [attempt]);

  return <iframe src={iframeUrl} />;
}

export function entrypoint(api: PluginAPI) {
  api.registerTaskAttemptViewTab({
    id: 'vscode-editor',
    label: 'Editor',
    component: VSCodeEditorTab,
  });
}
```

### What We Need to Extract

From the plugin branch, we need:

1. **Plugin API Types** (`frontend/src/lib/plugin-api.ts`)
   - Interface definitions for `PluginAPI`, `TaskAttemptViewTabProps`, etc.
   - This defines the contract between plugins and host app

2. **Plugin Host Logic** (`frontend/src/lib/plugin-host.tsx`)
   - Plugin registry management
   - React Context and hooks
   - Plugin initialization and validation

3. **Plugin Loader** (`frontend/src/lib/plugin-loader.ts`)
   - Manifest fetching
   - Dynamic module loading
   - Error handling

4. **UI Integration Hooks** (from `TaskAttemptTabs.tsx`)
   - The `useTaskAttemptViewTabs()` integration pattern
   - How to render plugin tabs alongside built-in tabs

5. **Plugin Build Config** (`plugins/*/vite.config.ts`, `package.json`)
   - Vite configuration for ESM output
   - Externalization of React/ReactDOM
   - TypeScript config

**What We DON'T Need:**
- Backend Rust code (we'll serve static files differently)
- Docker deployment logic from vibe-kanban
- The actual vscode-embed plugin (will rebuild separately)

---

## Caddy Module Research

### Official Resources

Based on research from:
- [Caddy Documentation - Extending Caddy](https://caddyserver.com/docs/extending-caddy)
- [caddyhttp package documentation](https://pkg.go.dev/github.com/caddyserver/caddy/v2/modules/caddyhttp)
- [replace-response module](https://github.com/caddyserver/replace-response)
- [caddy2-html-injection-plugin](https://pkg.go.dev/github.com/toowoxx/caddy2-html-injection-plugin)

### Key Caddy Concepts for Our Use Case

#### 1. Module Registration

All Caddy modules must:
- Implement `CaddyModule()` method returning `caddy.ModuleInfo`
- Register via `caddy.RegisterModule()` in `init()` function
- Follow namespace conventions (we'll use `http.handlers.*`)

```go
package myplugin

import "github.com/caddyserver/caddy/v2"

func init() {
    caddy.RegisterModule(MyHandler{})
}

type MyHandler struct {}

func (MyHandler) CaddyModule() caddy.ModuleInfo {
    return caddy.ModuleInfo{
        ID:  "http.handlers.vibe_kanban_plugin_injector",
        New: func() caddy.Module { return new(MyHandler) },
    }
}
```

#### 2. HTTP Middleware Pattern

For modifying responses, implement `caddyhttp.MiddlewareHandler`:

```go
import "github.com/caddyserver/caddy/v2/modules/caddyhttp"

func (h MyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
    // Wrap response writer to intercept writes
    rec := &responseRecorder{ResponseWriter: w}

    // Call upstream handler
    err := next.ServeHTTP(rec, r)

    // Modify response body before writing
    modifiedBody := modifyResponse(rec.body)
    w.Write(modifiedBody)

    return err
}
```

#### 3. Response Body Modification

**Two Approaches:**

**A. Buffer Mode (recommended for our use case)**:
- Buffer entire response body
- Perform replacements/injections
- Write modified response
- Guarantees correct `Content-Length` header
- Used by `replace-response` module

**B. Stream Mode**:
- Process response in chunks
- More memory efficient
- May break `Content-Length` (must remove header)
- Complex for multi-part injections

**We'll use Buffer Mode** because:
- Vibe Kanban JS bundles are small enough to buffer
- We need multiple injection points (imports, exports, HTML)
- Correctness is more important than streaming performance

#### 4. Content-Type Filtering

Only modify specific content types:

```go
contentType := w.Header().Get("Content-Type")

if strings.HasPrefix(contentType, "text/html") {
    // Inject <script> tags
    body = injectScriptTags(body)
} else if strings.HasPrefix(contentType, "application/javascript") {
    // Inject plugin system hooks
    body = injectPluginHooks(body)
}
```

#### 5. Existing HTML Injection Module

`github.com/toowoxx/caddy2-html-injection-plugin` provides:
- Simple text injection before/after HTML tags
- Content-Type regex matching
- File-based injection sources

**Limitations for our use case:**
- Only handles HTML (we need JS modification too)
- No programmatic JS manipulation
- No support for multiple injection points in same file

**We'll build a custom module** inspired by this but with:
- JavaScript AST manipulation (or regex for monkey-patching)
- Multiple injection strategies (HTML, JS imports, JS exports)
- Configuration for plugin manifest URL

### replace-response Module Analysis

Official Caddy module for response modification:
- GitHub: https://github.com/caddyserver/replace-response
- Supports substring and regex replacements
- Buffer and stream modes

**Example Caddyfile**:
```
replace {
    stream
    match {
        header Content-Type application/json*
    }
    re "\s+foo(bar|baz)\s+" " foo $1 "
}
```

**Example JSON config**:
```json
{
  "handler": "replace_response",
  "replacements": [
    {
      "search_regexp": "\\s+foo(bar|baz)\\s+",
      "replace": " foo $1 "
    }
  ],
  "stream": false
}
```

**Critical Note:** Cannot modify compressed content - must disable compression or decompress first.

---

## Architecture Design

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Vibe Kanban UI (with injected plugin system)        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ Plugin API │  │ Plugin Host│  │ Plugin Tabs│     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  │         ▲               ▲               ▲            │  │
│  │         └───────────────┴───────────────┘            │  │
│  │              (injected via Caddy)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP Requests
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Caddy Reverse Proxy                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Custom Module: vibe-kanban-plugin-injector        │    │
│  │                                                     │    │
│  │  1. Intercept HTML responses                       │    │
│  │     → Inject <script src="/plugins/init.js">       │    │
│  │                                                     │    │
│  │  2. Intercept JS responses                         │    │
│  │     → Monkey-patch React component exports         │    │
│  │     → Add plugin system hooks                      │    │
│  │                                                     │    │
│  │  3. Serve plugin files                             │    │
│  │     → /plugins/init.js (plugin loader)             │    │
│  │     → /plugins/manifest.json                       │    │
│  │     → /plugins/{id}/bundle.js                      │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│                  [Pass-through to upstream]                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Proxy to
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Vibe Kanban (npx @vibe-kanban/cli)             │
│              Running on localhost:3000                       │
│              (Unmodified production build)                   │
└─────────────────────────────────────────────────────────────┘
```

### Caddy Module Design

**Module Name:** `http.handlers.vibe_kanban_plugin_injector`

**Configuration:**
```json
{
  "handler": "vibe_kanban_plugin_injector",
  "plugin_manifest_url": "/plugins/manifest.json",
  "plugin_loader_url": "/plugins/init.js",
  "plugin_base_path": "/plugins",
  "inject_into_routes": [
    "/",
    "/projects/*",
    "/tasks/*"
  ]
}
```

**Module Responsibilities:**

1. **HTML Injection**
   - Detect HTML responses (Content-Type: text/html)
   - Inject `<script src="/plugins/init.js"></script>` before `</head>`
   - Inject temporary plugin system activation before `</body>`:
     ```html
     <script>
       window.__VIBE_PLUGIN_API__ = {
         registry: { tabs: [], components: [] },
         registerTab: function(tab) { this.registry.tabs.push(tab); },
         registerComponent: function(comp) { this.registry.components.push(comp); }
       };
     </script>
     ```

2. **JavaScript Monkey-Patching**
   - Detect JS responses (Content-Type: application/javascript)
   - Target specific files (e.g., `TaskAttemptTabs.*.js`)
   - Inject hooks to expose plugin registry on window
   - Modify component exports to check for registered plugins

3. **Static File Serving**
   - Serve `/plugins/init.js` (plugin loader script)
   - Serve `/plugins/manifest.json` (list of available plugins)
   - Serve `/plugins/{id}/bundle.js` (individual plugin bundles)

**Implementation Strategy:**

```go
type PluginInjector struct {
    PluginManifestURL string `json:"plugin_manifest_url,omitempty"`
    PluginLoaderURL   string `json:"plugin_loader_url,omitempty"`
    PluginBasePath    string `json:"plugin_base_path,omitempty"`
    InjectIntoRoutes  []string `json:"inject_into_routes,omitempty"`
}

func (p *PluginInjector) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
    // Check if request matches inject routes
    if !p.shouldInject(r.URL.Path) {
        return next.ServeHTTP(w, r)
    }

    // Serve plugin files directly
    if strings.HasPrefix(r.URL.Path, p.PluginBasePath) {
        return p.servePluginFile(w, r)
    }

    // Intercept response from upstream
    rec := newResponseRecorder(w)
    err := next.ServeHTTP(rec, r)
    if err != nil {
        return err
    }

    // Modify based on content type
    contentType := rec.Header().Get("Content-Type")
    body := rec.body

    if strings.HasPrefix(contentType, "text/html") {
        body = p.injectIntoHTML(body)
    } else if strings.HasPrefix(contentType, "application/javascript") {
        body = p.injectIntoJS(body, r.URL.Path)
    }

    // Write modified response
    w.Header().Set("Content-Length", strconv.Itoa(len(body)))
    w.WriteHeader(rec.statusCode)
    w.Write(body)

    return nil
}
```

### JavaScript Injection Strategy

#### Approach 1: Regex-Based Monkey Patching (Recommended)

**Target:** `TaskAttemptTabs.*.js` (or similar Vite chunk)

**Find Pattern:**
```javascript
// Original export from Vite build
export function TaskAttemptTabs(props) {
  return /* ...JSX... */
}
```

**Inject After:**
```javascript
export function TaskAttemptTabs(props) {
  // Original implementation
  const originalReturn = /* original JSX */;

  // Check for plugin tabs
  if (window.__VIBE_PLUGIN_API__ && window.__VIBE_PLUGIN_API__.registry.tabs.length > 0) {
    const pluginTabs = window.__VIBE_PLUGIN_API__.registry.tabs;
    // Merge plugin tabs with originalReturn
    return /* modified JSX with plugin tabs */;
  }

  return originalReturn;
}
```

**Regex Replacement:**
```go
pattern := regexp.MustCompile(`(export\s+function\s+TaskAttemptTabs\s*\([^)]*\)\s*\{)`)
replacement := `$1
    const __pluginTabs = window.__VIBE_PLUGIN_API__?.registry?.tabs || [];
    const __originalTabs = `
body = pattern.ReplaceAllString(body, replacement)
```

**Challenges:**
- Vite minifies and mangles names in production
- Need to identify correct chunk (may change between versions)
- Fragile to Vibe Kanban updates

#### Approach 2: Global Hook Injection (Simpler, Recommended)

Instead of patching specific functions, inject global hooks that components can check:

**Inject at start of main bundle:**
```javascript
// Injected by Caddy at start of main.*.js
window.__VIBE_PLUGINS__ = {
  tabs: [],
  components: [],
  hooks: {
    useTaskAttemptTabs: function() {
      return this.tabs;
    }
  }
};
```

**Then in plugin-loader (init.js):**
```javascript
// Loaded via <script src="/plugins/init.js">
async function loadPlugins() {
  const manifest = await fetch('/plugins/manifest.json').then(r => r.json());

  for (const plugin of manifest.plugins) {
    const module = await import(plugin.bundleUrl);

    // Plugin calls our temporary API
    module.entrypoint({
      registerTaskAttemptViewTab: (tab) => {
        window.__VIBE_PLUGINS__.tabs.push(tab);
      }
    });
  }

  // Trigger re-render somehow?
  // Option A: Dispatch custom event
  window.dispatchEvent(new CustomEvent('vibe-plugins-loaded'));

  // Option B: Modify DOM directly (hacky)
  // Option C: Wait for React to expose hooks (requires more patching)
}

loadPlugins();
```

**The Problem:** How does React know about the new tabs?

**Solution:** Patch React hooks or use DOM manipulation:

```javascript
// Patch useTaskAttemptViewTabs hook
// Find pattern: export function useTaskAttemptViewTabs() { return ...; }
// Replace with:
export function useTaskAttemptViewTabs() {
  const [pluginTabs, setPluginTabs] = React.useState(window.__VIBE_PLUGINS__.tabs);

  React.useEffect(() => {
    const handler = () => setPluginTabs(window.__VIBE_PLUGINS__.tabs);
    window.addEventListener('vibe-plugins-loaded', handler);
    return () => window.removeEventListener('vibe-plugins-loaded', handler);
  }, []);

  return pluginTabs;
}
```

#### Approach 3: Runtime Code Extraction & Injection (Cleanest)

**Strategy:**
1. Extract plugin system code from plugin branch
2. Bundle it into a **separate standalone script** (`/plugins/system.js`)
3. Inject that script into HTML (no JS patching needed)
4. Script patches React components at runtime using DOM manipulation or React dev tools

**Benefits:**
- No fragile regex on minified code
- All plugin logic in one place
- Can update plugin system without changing Caddy module
- Works across Vibe Kanban versions (as long as DOM structure is similar)

**How it works:**

`/plugins/system.js`:
```javascript
// Extracted from frontend/src/lib/plugin-host.tsx
import { createContext, useContext, useState, useEffect } from 'react';

// This is bundled and injected into page
// It monkey-patches React components after page load
(function() {
  // Wait for React to be available
  const React = window.React;
  const ReactDOM = window.ReactDOM;

  // Create plugin context
  const PluginContext = React.createContext({ tabs: [], components: [] });

  // Patch specific components by finding them in React fiber tree
  // (This is hacky but works)

  // Alternative: Use MutationObserver to detect when TaskAttemptTabs renders,
  // then modify its children
})();
```

**This is complex but most robust.**

### Recommended Approach: Hybrid

1. **Extract plugin system code** from plugin branch
2. **Bundle as standalone ES module** (`/plugins/system.js`)
3. **Inject minimal shim into HTML**:
   ```html
   <script type="module">
     import { initPluginSystem } from '/plugins/system.js';
     initPluginSystem({ manifestUrl: '/plugins/manifest.json' });
   </script>
   ```
4. **Plugin system script:**
   - Loads manifest
   - Imports plugin bundles
   - Uses DOM selectors to find tab containers
   - Injects plugin tabs using React.createElement + ReactDOM.render

**Advantages:**
- No JS file patching needed
- Plugin system is self-contained
- Easy to update independently
- Works across versions (as long as DOM selectors are stable)

**Disadvantages:**
- Relies on DOM selectors (fragile if Vibe Kanban changes structure)
- Plugins can't use internal hooks like `useTaskAttempt` (need to reimplement)

**Mitigation:**
- Also inject a small patch to expose `useTaskAttempt` on window:
  ```go
  // In Caddy: Find export of useTaskAttempt hook
  pattern := regexp.MustCompile(`(export\s+function\s+useTaskAttempt)`)
  replacement := `window.__VIBE_HOOKS__ = window.__VIBE_HOOKS__ || {};
  window.__VIBE_HOOKS__.useTaskAttempt = useTaskAttempt;
  $1`
  ```

---

## Code Extraction Plan

### Files to Extract from Plugin Branch

#### 1. Frontend Plugin System (to `vibe-kanban-caddy-module/injected-code/`)

**Core plugin system:**
- `frontend/src/lib/plugin-api.ts` → `injected-code/src/plugin-api.ts`
- `frontend/src/lib/plugin-host.tsx` → `injected-code/src/plugin-host.tsx`
- `frontend/src/lib/plugin-loader.ts` → `injected-code/src/plugin-loader.ts`

**UI integration patterns (for reference):**
- `frontend/src/components/panels/TaskAttemptTabs.tsx` → `injected-code/reference/TaskAttemptTabs.tsx`

**Build these into:**
```
vibe-kanban-caddy-module/
└── injected-code/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── src/
    │   ├── plugin-api.ts
    │   ├── plugin-host.tsx
    │   ├── plugin-loader.ts
    │   └── runtime-injector.ts   # NEW: DOM manipulation logic
    └── dist/
        └── system.js              # Bundled output
```

**`vite.config.ts` for injected code:**
```typescript
export default defineConfig({
  build: {
    lib: {
      entry: 'src/runtime-injector.ts',
      formats: ['es'],
      fileName: 'system',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    outDir: 'dist',
  },
});
```

#### 2. Plugin Template (to `vibe-kanban-caddy-module/plugins/`)

**Copy plugin structure:**
- `plugins/vscode-embed/` → `vibe-kanban-caddy-module/plugins/vscode-embed/`
- `plugins/example-plugin/` → `vibe-kanban-caddy-module/plugins/example-plugin/`
- `plugins/README.md` → `vibe-kanban-caddy-module/plugins/README.md`

**Modify plugin imports:**
```typescript
// OLD (plugin branch):
import type { PluginAPI } from '../../frontend/src/lib/plugin-api';

// NEW (caddy module):
import type { PluginAPI } from '@vibe-kanban-proxy/plugin-api';
// or just use global types:
/// <reference types="./plugin-api.d.ts" />
```

#### 3. Type Definitions (to `vibe-kanban-caddy-module/types/`)

Create standalone type definitions:
```typescript
// types/plugin-api.d.ts
export interface PluginAPI {
  registerTaskAttemptViewTab(registration: TaskAttemptViewTabRegistration): void;
  registerDashboardComponent(registration: DashboardComponentRegistration): void;
}

export interface TaskAttemptViewTabProps {
  taskAttemptId: string;
  taskId: string;
  projectId: string;
}

// ... etc
```

### New Files to Create

#### 1. Caddy Module (Go)

```
vibe-kanban-caddy-module/
├── go.mod
├── go.sum
├── main.go                    # Caddy with custom module
├── handler.go                 # HTTP handler implementation
├── injector.go                # HTML/JS injection logic
└── config.go                  # Configuration struct
```

**`handler.go` skeleton:**
```go
package vibekanbanplugins

import (
    "github.com/caddyserver/caddy/v2"
    "github.com/caddyserver/caddy/v2/modules/caddyhttp"
    "net/http"
)

func init() {
    caddy.RegisterModule(PluginInjector{})
}

type PluginInjector struct {
    PluginBasePath string `json:"plugin_base_path,omitempty"`
    // ... config fields
}

func (PluginInjector) CaddyModule() caddy.ModuleInfo {
    return caddy.ModuleInfo{
        ID:  "http.handlers.vibe_kanban_plugin_injector",
        New: func() caddy.Module { return new(PluginInjector) },
    }
}

func (p *PluginInjector) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
    // Implementation
}
```

#### 2. Docker Build Configuration

```
vibe-kanban-caddy-module/
├── Dockerfile.caddy           # Builds Caddy with custom module
├── Dockerfile.plugin-builder  # Builds plugin system code
├── docker-compose.yml         # Orchestrates everything
└── Caddyfile                  # Caddy configuration
```

**`Dockerfile.caddy`:**
```dockerfile
FROM caddy:2-builder AS builder

# Copy custom module
COPY . /src/vibe-kanban-plugins
WORKDIR /src/vibe-kanban-plugins

# Build Caddy with custom module
RUN xcaddy build \
    --with github.com/yourusername/vibe-kanban-plugins=.

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
```

**`Dockerfile.plugin-builder`:**
```dockerfile
FROM node:20-alpine

WORKDIR /workspace

# Build injected plugin system
COPY injected-code/package.json injected-code/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY injected-code/ ./
RUN pnpm build

# Build actual plugins
COPY plugins/ /plugins
RUN cd /plugins && pnpm install && pnpm -r build

# Output: /workspace/dist/system.js and /plugins/*/dist/plugin.js
```

#### 3. Docker Compose

```yaml
services:
  # Build plugin system code and plugins
  plugin-builder:
    build:
      context: .
      dockerfile: Dockerfile.plugin-builder
    volumes:
      - plugin-dist:/workspace/dist
      - plugins-dist:/plugins
    command: sh -c "pnpm build && pnpm -r --filter './plugins/*' build"

  # Build and run Caddy with custom module
  caddy:
    build:
      context: .
      dockerfile: Dockerfile.caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - plugin-dist:/srv/plugins:ro
      - plugins-dist:/srv/plugins/bundles:ro
    depends_on:
      - plugin-builder
      - vibe-kanban
    environment:
      - VIBE_KANBAN_UPSTREAM=http://vibe-kanban:3000

  # Run production Vibe Kanban via npx
  vibe-kanban:
    image: node:20-alpine
    working_dir: /app
    command: npx @vibe-kanban/cli@0.0.143-20251229180119
    ports:
      - "3000"
    environment:
      - BACKEND_PORT=3000

volumes:
  plugin-dist:
  plugins-dist:
```

#### 4. Caddyfile

```
{
    order vibe_kanban_plugin_injector before reverse_proxy
}

:80 {
    # Serve plugin files
    handle /plugins/* {
        root * /srv/plugins
        file_server
    }

    # Inject plugin system
    vibe_kanban_plugin_injector {
        plugin_base_path "/plugins"
        plugin_manifest_url "/plugins/manifest.json"
        plugin_loader_url "/plugins/system.js"
    }

    # Proxy to Vibe Kanban
    reverse_proxy {$VIBE_KANBAN_UPSTREAM} {
        header_up -Accept-Encoding  # Disable compression for injection
    }
}
```

---

## Implementation Phases

### Phase 1: Proof of Concept (2-3 hours)

**Goal:** Inject a simple `console.log()` into Vibe Kanban HTML

**Tasks:**
1. Create basic Caddy module that intercepts HTML responses
2. Inject `<script>console.log('Plugin system active!')</script>` before `</body>`
3. Test with `docker-compose up`
4. Verify injection works in browser console

**Files:**
- `handler.go` - Basic ServeHTTP implementation
- `Dockerfile.caddy` - Build Caddy with module
- `docker-compose.yml` - Run Caddy + npx vibe-kanban
- `Caddyfile` - Basic reverse proxy config

**Success Criteria:**
- Browser console shows "Plugin system active!"
- Vibe Kanban app loads normally
- No errors in Caddy logs

### Phase 2: Plugin System Injection (4-6 hours)

**Goal:** Inject extracted plugin system code

**Tasks:**
1. Extract plugin system files from plugin branch
2. Create `injected-code/` directory with Vite build
3. Build standalone `system.js` bundle
4. Modify Caddy to serve `/plugins/system.js`
5. Inject `<script type="module" src="/plugins/system.js"></script>` into HTML
6. Verify plugin API is available on `window`

**Files:**
- `injected-code/src/plugin-api.ts`
- `injected-code/src/plugin-host.tsx`
- `injected-code/src/plugin-loader.ts`
- `injected-code/src/runtime-injector.ts` (NEW)
- `injected-code/vite.config.ts`
- `Dockerfile.plugin-builder`

**Success Criteria:**
- `window.__VIBE_PLUGIN_API__` is defined
- Plugin loader fetches `/plugins/manifest.json`
- No React errors in console

### Phase 3: DOM-Based Tab Injection (4-6 hours)

**Goal:** Add plugin tabs without patching JS

**Tasks:**
1. Create runtime DOM manipulation logic
2. Find TaskAttemptTabs container using selectors
3. Use React.createElement + ReactDOM.render to add tabs
4. Test with a dummy plugin

**Files:**
- `injected-code/src/dom-injector.ts` (NEW)
- `plugins/hello-world/` (test plugin)

**Success Criteria:**
- Plugin tab appears in task attempt view
- Clicking tab shows plugin content
- No crashes or errors

### Phase 4: Hook Exposure (2-4 hours)

**Goal:** Expose `useTaskAttempt` and other hooks to plugins

**Tasks:**
1. Implement regex-based JS patching in Caddy
2. Find and wrap `useTaskAttempt` export
3. Expose on `window.__VIBE_HOOKS__`
4. Update plugin template to use exposed hooks

**Files:**
- `injector.go` - JS patching logic
- `plugins/vscode-embed/` - Real plugin using hooks

**Success Criteria:**
- Plugins can call `window.__VIBE_HOOKS__.useTaskAttempt(id)`
- VS Code embed plugin works (shows worktree path)

### Phase 5: Multi-Plugin Support (2-3 hours)

**Goal:** Load multiple plugins from manifest

**Tasks:**
1. Implement manifest.json generation in Caddy
2. Discover plugins from `/srv/plugins/bundles/`
3. Test with 2-3 plugins simultaneously

**Files:**
- `manifest-generator.go` (NEW)
- `plugins/example-1/`, `plugins/example-2/`

**Success Criteria:**
- All plugins listed in manifest
- All plugins load successfully
- Multiple tabs appear

### Phase 6: Production Polish (4-6 hours)

**Goal:** Error handling, caching, documentation

**Tasks:**
1. Add error boundaries to plugin system
2. Implement caching headers
3. Add logging and debugging
4. Write comprehensive README
5. Create plugin developer guide

**Files:**
- `README.md`
- `PLUGIN_DEVELOPMENT.md`
- `TROUBLESHOOTING.md`

**Success Criteria:**
- Failed plugins don't crash app
- Good developer documentation
- Clear error messages

---

## Docker Compose Setup

### Final Directory Structure

```
vibe-kanban-caddy-module/
├── README.md
├── PLUGIN_DEVELOPMENT.md
├── TROUBLESHOOTING.md
├── go.mod
├── go.sum
├── main.go
├── handler.go
├── injector.go
├── config.go
├── manifest-generator.go
├── Dockerfile.caddy
├── Dockerfile.plugin-builder
├── docker-compose.yml
├── Caddyfile
│
├── injected-code/              # Plugin system runtime
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── plugin-api.ts
│   │   ├── plugin-host.tsx
│   │   ├── plugin-loader.ts
│   │   ├── runtime-injector.ts
│   │   └── dom-injector.ts
│   └── dist/
│       └── system.js           # Built bundle
│
├── plugins/                    # Plugin projects
│   ├── README.md
│   ├── example-plugin/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── src.tsx
│   │   └── dist/
│   │       └── plugin.js
│   └── vscode-embed/
│       ├── package.json
│       ├── vite.config.ts
│       ├── src.tsx
│       └── dist/
│           └── plugin.js
│
└── types/                      # Shared TypeScript types
    └── plugin-api.d.ts
```

### Container Orchestration

**Build Order:**
1. `plugin-builder` - Builds plugin system + all plugins
2. `vibe-kanban` - Starts `npx @vibe-kanban/cli`
3. `caddy` - Starts Caddy with custom module

**Runtime Flow:**
1. User requests `http://localhost/`
2. Caddy intercepts request
3. Proxies to Vibe Kanban on port 3000
4. Vibe Kanban returns HTML
5. Caddy injects `<script src="/plugins/system.js"></script>`
6. Returns modified HTML to browser
7. Browser loads `/plugins/system.js` from Caddy
8. Plugin system loads `/plugins/manifest.json`
9. Plugins load and register

---

## Next Steps

### Immediate Actions (Today)

1. **Set up repository structure**
   ```bash
   cd vibe-kanban-caddy-module
   git init
   mkdir -p injected-code/src plugins types
   ```

2. **Extract plugin system code**
   ```bash
   # From vibe-kanban plugin branch
   cp ../vibe-kanban/frontend/src/lib/plugin-api.ts injected-code/src/
   cp ../vibe-kanban/frontend/src/lib/plugin-host.tsx injected-code/src/
   cp ../vibe-kanban/frontend/src/lib/plugin-loader.ts injected-code/src/
   ```

3. **Copy plugin templates**
   ```bash
   cp -r ../vibe-kanban/plugins/vscode-embed plugins/
   cp -r ../vibe-kanban/plugins/example-plugin plugins/
   cp ../vibe-kanban/plugins/README.md plugins/
   ```

4. **Initialize Go module**
   ```bash
   go mod init github.com/yourusername/vibe-kanban-plugins
   go get github.com/caddyserver/caddy/v2
   ```

5. **Create basic Caddy module** (Phase 1 POC)
   - Write `handler.go` with simple HTML injection
   - Test with `xcaddy run`

### Short Term (This Week)

1. **Phase 1: Proof of Concept**
   - Get basic injection working
   - Verify Caddy module compiles
   - Test with Docker Compose

2. **Phase 2: Plugin System Injection**
   - Build standalone plugin system bundle
   - Inject into HTML
   - Verify in browser

3. **Phase 3: DOM-Based Tabs**
   - Implement tab injection
   - Create hello-world plugin
   - Test rendering

### Medium Term (Next Week)

1. **Phase 4: Hook Exposure**
   - Implement JS patching
   - Expose `useTaskAttempt`
   - Port VS Code embed plugin

2. **Phase 5: Multi-Plugin Support**
   - Build manifest generator
   - Test multiple plugins
   - Fix any conflicts

### Long Term (Next Month)

1. **Phase 6: Production Polish**
   - Error handling
   - Documentation
   - Performance optimization

2. **Advanced Features**
   - Hot reload for plugin development
   - Plugin marketplace/registry
   - Automated testing

---

## Technical Challenges & Mitigations

### Challenge 1: Vite Build Changes

**Problem:** Vite hashes filenames and changes bundle structure between versions

**Mitigation:**
- Use DOM selectors instead of file patching where possible
- Make JS patching optional (graceful degradation)
- Test against multiple Vibe Kanban versions

### Challenge 2: React Hooks Access

**Problem:** Plugins need `useTaskAttempt` which is internal

**Solutions:**
1. **Option A:** Expose via window patching (fragile)
2. **Option B:** Reimplement hook using fetch (duplicates code)
3. **Option C:** Proxy API calls through plugin system (clean)

**Recommended:** Option C
```typescript
// In injected plugin system
export const pluginAPI = {
  hooks: {
    useTaskAttempt: (id: string) => {
      // Reimplemented using react-query
      return useQuery(['task-attempt', id], () =>
        fetch(`/api/task-attempts/${id}`).then(r => r.json())
      );
    }
  }
};
```

### Challenge 3: Compressed Responses

**Problem:** Caddy can't modify gzipped responses

**Mitigation:**
```go
// In handler.go
func (p *PluginInjector) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
    // Disable compression for proxied requests
    r.Header.Set("Accept-Encoding", "identity")

    // ... rest of handler
}
```

### Challenge 4: CORS and CSP

**Problem:** Browser security may block injected scripts

**Mitigation:**
- Serve plugins from same origin (Caddy)
- Modify CSP headers if needed:
  ```go
  w.Header().Set("Content-Security-Policy",
      "script-src 'self' 'unsafe-inline'; ...")
  ```

---

## Alternative Approaches Considered

### 1. Fork Vibe Kanban

**Pros:**
- Full control over plugin system
- Can use TypeScript throughout
- No fragile injection

**Cons:**
- Must maintain fork
- Must rebase on every update
- Doesn't meet requirement of "no compilation"

**Decision:** Rejected - defeats purpose of runtime extension

### 2. Browser Extension

**Pros:**
- No server-side code needed
- Easy to distribute

**Cons:**
- Users must install extension
- Limited to browser that supports extensions
- Can't modify server responses (only DOM)

**Decision:** Rejected - want transparent server-side solution

### 3. Service Worker Proxy

**Pros:**
- Can intercept requests in browser
- No Caddy needed

**Cons:**
- Requires HTTPS
- Complex service worker logic
- Browser compatibility issues

**Decision:** Rejected - more complex than Caddy approach

---

## Success Criteria

### Minimum Viable Product (MVP)

- [ ] Caddy module compiles and runs
- [ ] Injects plugin system into Vibe Kanban HTML
- [ ] Plugins can register tabs via API
- [ ] At least one working plugin (hello-world)
- [ ] Docker Compose setup works end-to-end
- [ ] Basic documentation for developers

### Production Ready

- [ ] Multiple plugins load simultaneously
- [ ] Error handling prevents crashes
- [ ] Works with latest Vibe Kanban version (v0.0.143)
- [ ] VS Code embed plugin fully functional
- [ ] Comprehensive developer documentation
- [ ] Example plugins covering all API methods
- [ ] Automated tests for Caddy module
- [ ] Performance acceptable (< 100ms injection overhead)

---

## Resources

### Caddy Development
- [Extending Caddy](https://caddyserver.com/docs/extending-caddy)
- [caddyhttp package](https://pkg.go.dev/github.com/caddyserver/caddy/v2/modules/caddyhttp)
- [replace-response module](https://github.com/caddyserver/replace-response)
- [caddy2-html-injection-plugin](https://pkg.go.dev/github.com/toowoxx/caddy2-html-injection-plugin)

### Vibe Kanban Plugin System
- `vibe-kanban/plugins/README.md` - Plugin development guide
- `vibe-kanban/review-vscode-embed-plugin.md` - Code review with best practices
- `vibe-kanban/frontend/src/lib/plugin-api.ts` - API interface definitions

### Tools
- [xcaddy](https://github.com/caddyserver/xcaddy) - Caddy module build tool
- [Vite](https://vitejs.dev/) - Frontend build tool for plugins
- [pnpm](https://pnpm.io/) - Fast package manager

---

## Conclusion

This architecture provides a **zero-compilation extension system** for Vibe Kanban by:

1. **Runtime JS injection** via Caddy reverse proxy
2. **Extracted plugin system** from experimental branch
3. **Docker-based deployment** with three containers
4. **Standard plugin development** workflow (Vite + React)

The approach is:
- ✅ **Non-invasive** - Doesn't modify Vibe Kanban source
- ✅ **Version-independent** - Works with any `npx` version
- ✅ **Developer-friendly** - Standard React/TypeScript workflow
- ✅ **Production-ready** - Dockerized and configurable

Next step: **Start with Phase 1 POC** to validate the approach.
