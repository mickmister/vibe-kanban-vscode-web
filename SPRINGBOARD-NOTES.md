# Springboard App Development Notes

Lessons learned from building the vibe-kanban workspace wrapper app.

## Module Structure

Everything lives inside `springboard.registerModule()`. The async callback is where you create state, define actions, and register routes.

```typescript
springboard.registerModule('myModule', { rpcMode: 'remote' }, async (moduleAPI) => {
  // 1. Create state
  // 2. Define actions
  // 3. Register routes
  // 4. Return public API + Provider
});
```

- The module callback only executes when `engine.initialize()` is called — registration is not execution.
- `rpcMode: 'remote'` for client-server communication, `'local'` for browser-only.
- Return a `Provider` from the module to wrap all routes (e.g., for `HeroUIProvider` or other context providers). Don't put providers inside individual route components.

## State Management

Three state types, pick based on persistence and sync needs:

| Type | Storage | Sync | Use For |
|---|---|---|---|
| `createSharedState` | In-memory (server) | Real-time cross-device | Cursors, typing indicators |
| `createPersistentState` | Database | Cross-device on load | User data, layout, settings |
| `createUserAgentState` | localStorage | None (device-local) | UI preferences, collapsed panels |

Read state in components via `state.useState()` (a React hook). Never mutate state directly in components.

## Actions

**All state mutations must go through `moduleAPI.createActions()`**, not directly in components. Actions are RPC-enabled.

Each action takes exactly **one argument** — a property bag object:

```typescript
const actions = moduleAPI.createActions({
  renameSpace: async (args: { spaceId: string; name: string }) => {
    workspaceState.setStateImmer((draft) => {
      const space = draft.spaces.find((s) => s.id === args.spaceId);
      if (space) space.name = args.name;
    });
  },
});
```

Pass actions into components as props and call them from event handlers:

```typescript
<Button onPress={() => actions.renameSpace({ spaceId: 'abc', name: 'New Name' })} />
```

## Routing

```typescript
moduleAPI.registerRoute('/', { hideApplicationShell: true }, MyComponent);
```

- Use `hideApplicationShell: true` when your app IS the full UI (no framework chrome wanted).
- Route components don't get full viewport height from Springboard's wrappers. Use `fixed inset-0 w-screen h-screen` on your root container to guarantee full-viewport layout.

## Tailwind CSS v4 + HeroUI Setup

### Dependencies

```bash
pnpm add tailwindcss @tailwindcss/vite @heroui/react framer-motion
```

### .npmrc (required for pnpm)

```
public-hoist-pattern[]=*@heroui/*
```

### vite.config.ts

```typescript
import tailwindcss from '@tailwindcss/vite';

plugins: [
  tailwindcss(),
  springboard({ ... }),
],
```

### hero.ts (in src/)

```typescript
import { heroui } from '@heroui/react';
export default heroui();
```

### styles.css (in src/)

```css
@import "tailwindcss";
@plugin './hero.ts';
@source '../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}';
@custom-variant dark (&:is(.dark *));
```

**The `@source` path is relative to the CSS file's location**, not the project root. Getting this wrong means HeroUI component classes silently won't generate any styles.

No `tailwind.config.js` needed — Tailwind v4 uses `@plugin` and `@source` directives in CSS.

## Project Structure Tips

- The `.springboard/` directory contains generated entry files. Don't rely on manual edits — they get regenerated on dev server start.
- `better-sqlite3` is a native module. Run `pnpm rebuild better-sqlite3` after fresh installs.
- Set `nodeServerPort` explicitly in the vite config to avoid port conflicts across restarts.

## Caddyfile Integration

When running behind Caddy as a reverse proxy, route ordering matters. More specific routes (wrapper app, vscode) must come before the fallback catch-all. Use matchers with `not query` to avoid conflicts between services sharing the same port:

```
@wrapper_root {
  path /
  not query folder=*
}
```
