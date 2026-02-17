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
