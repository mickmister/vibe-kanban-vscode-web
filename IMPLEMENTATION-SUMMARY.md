# VK Cloud Connection - Implementation Summary

## ✅ Complete - Ready to Test

All code changes are implemented and committed. The vscode-web container can now connect local VK instances to a self-hosted cloud server with zero source builds required.

## How It Works

### The Problem
- Official vibe-kanban npm package has `https://api.vibekanban.com` hardcoded in the JS bundle
- Setting `VK_SHARED_API_BASE` env var only affects the Rust backend, not the frontend
- Frontend's `VITE_VK_SHARED_API_BASE` is baked in at build time, can't be changed at runtime

### The Solution
- **Custom Caddy module** intercepts JavaScript responses
- **Literal string replacement**: `https://api.vibekanban.com` → your cloud URL
- **Reads from env var** at Caddy startup (`VK_CLOUD_URL`)
- **Works with any npx version** - no source builds needed

## Architecture

```
User Request → Caddy (vk_rewrite) → VK Server → Response
                  ↓
            Intercepts .js
            Replaces API URL
            Returns modified JS
                  ↓
            Browser gets cloud-connected JS
```

## Files Modified

| File | What Changed |
|------|-------------|
| `caddy-module/handler.go` | Rewrote to intercept JS, replace URLs, register directive |
| `Dockerfile` | Build custom Caddy with xcaddy instead of apt install |
| `Caddyfile` | Added `vk_rewrite` directive before reverse_proxy |
| `supervisord.conf` | Added `VK_SHARED_API_BASE` (backend) and `VK_CLOUD_URL` (Caddy) |
| `docker-compose.yaml` | Added `VK_CLOUD_URL` env var passthrough |
| `.env.example` | Documented cloud connection usage |

## Usage

### 1. Set up the cloud instance first
Follow `CLOUD-DEPLOYMENT-RESEARCH.md` to deploy the remote server.

### 2. Configure local instances
Create `.env`:
```env
CODE_PASSWORD=your-password
VK_CLOUD_URL=https://vk-cloud.example.com
```

### 3. Build and run
```bash
docker-compose up --build
```

The container will:
1. Build custom Caddy binary with vk_rewrite module (~2min first build)
2. Start local VK (connects backend to cloud via `VK_SHARED_API_BASE`)
3. Start Caddy (rewrites frontend JS at runtime)
4. You get a fully cloud-connected local VK instance

### 4. Verify
- Open http://localhost:3001
- Check browser console for VK API requests - should go to your cloud URL
- Local execution/terminal features still work (SQLite, processes, git)
- Cloud features work (orgs, projects, issues, real-time sync)

## Testing Checklist

- [ ] Docker image builds successfully (xcaddy compiles Caddy)
- [ ] Caddy starts without errors (check `VK_CLOUD_URL` is read)
- [ ] Local VK connects to cloud backend (check VK logs for remote client init)
- [ ] JS bundle is rewritten (inspect network tab, look at .js file content)
- [ ] Cloud login works (OAuth flow redirects to cloud instance)
- [ ] Organization/project sync works

## Debugging

### Check if Caddy module loaded
```bash
docker-compose exec code-vibe caddy list-modules | grep vibe
# Should output: http.handlers.vibe_kanban_rewriter
```

### Check if env var is set
```bash
docker-compose exec code-vibe env | grep VK_CLOUD_URL
```

### Check if JS is being rewritten
```bash
# Request a JS file through Caddy
curl -s http://localhost:3001/assets/index-*.js | grep -o "https://[^\"]*vibekanban"
# Should output your custom cloud URL, not api.vibekanban.com
```

### View Caddy logs
```bash
docker-compose logs code-vibe | grep caddy
# Look for: "rewrote VK cloud API URLs in JavaScript"
```

## Next Steps

1. **Build cloud stack** - See `CLOUD-DEPLOYMENT-RESEARCH.md` for full details
2. **Set up GitHub OAuth** - Configure callback URL for your cloud instance
3. **Test end-to-end** - Build both cloud and local, verify connection
4. **Deploy multiple local instances** - Each team member gets their own container

## Caddyfile Directive Reference

The `vk_rewrite` directive is now available:

```caddyfile
vk_rewrite                          # Reads VK_CLOUD_URL env var
vk_rewrite https://custom.url.com   # Explicit URL (overrides env)
```

Must be placed **before** `reverse_proxy` in the handler chain.

## Sources

- [Caddy Caddyfile Support](https://caddyserver.com/docs/extending-caddy/caddyfile)
- [Caddy Handler Directive](https://caddyserver.com/docs/caddyfile/directives/handle)
- [Caddy Directive Ordering](https://caddyserver.com/docs/caddyfile/directives)
