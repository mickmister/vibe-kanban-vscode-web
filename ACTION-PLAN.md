# Action Plan: Self-Hosted VK Cloud + Distributed Local Instances

## Goal

One self-hosted cloud instance (remote server) with multiple vscode-web containers each running local VK, all connected to the shared cloud. Caddy MITM rewrites `VITE_VK_SHARED_API_BASE` in the local frontend JS at runtime so no source build is needed for the local client.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Cloud Stack (one instance)                         │
│  ┌────────────┐  ┌───────────┐  ┌───────────────┐  │
│  │ remote-srv │──│ PostgreSQL │──│  ElectricSQL  │  │
│  │   :8081    │  │   :5432   │  │    :3000      │  │
│  └────────────┘  └───────────┘  └───────────────┘  │
│  ┌────────────┐  ┌───────────┐                      │
│  │   Caddy    │  │  Azurite  │                      │
│  │   :443     │  │  :10000   │                      │
│  └────────────┘  └───────────┘                      │
└─────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
  ┌──────┴──┐    ┌──────┴──┐    ┌─────┴───┐
  │ vscode  │    │ vscode  │    │ vscode  │
  │ -web A  │    │ -web B  │    │ -web C  │
  │ local VK│    │ local VK│    │ local VK│
  └─────────┘    └─────────┘    └─────────┘
```

## Tasks

### 1. Build & publish the remote server Docker image

Build from `Vktest/crates/remote/Dockerfile` with no `FEATURES` arg (strips billing automatically).

```bash
cd Vktest
docker build -f crates/remote/Dockerfile -t ghcr.io/our-org/vk-remote:latest .
docker push ghcr.io/our-org/vk-remote:latest
```

No Rust toolchain, no private repo access needed at runtime. Image is ~150MB.

### 2. Create cloud stack docker-compose

Separate compose file for the cloud instance. Five services: postgres, azurite, azurite-init, remote-server, electric. Front it with Caddy for TLS.

**Required `.env`:**
```env
POSTGRES_PASSWORD=<strong>
VIBEKANBAN_REMOTE_JWT_SECRET=<openssl rand -base64 48>
ELECTRIC_ROLE_PASSWORD=<strong>
PUBLIC_BASE_URL=https://vk-cloud.example.com
GITHUB_OAUTH_CLIENT_ID=<from github>
GITHUB_OAUTH_CLIENT_SECRET=<from github>
LOOPS_EMAIL_API_KEY=              # empty string = emails disabled but server runs
```

**GitHub OAuth App callback:** `https://vk-cloud.example.com/v1/oauth/github/callback`

### 3. Caddy MITM rewrite in vscode-web containers

Add a `response_body` replacement in the vscode-web Caddyfile to inject `VITE_VK_SHARED_API_BASE` into the local VK frontend JS at proxy time. This avoids any source build.

The local frontend's `remoteApi.ts` compiles to something like:
```js
const REMOTE_API_URL = "" || "";
```

Caddy can rewrite responses from the local VK server to inject the cloud URL:

```caddyfile
handle /* {
    reverse_proxy localhost:3007 {
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }
    # Rewrite JS responses to inject cloud API URL
    @js_response header Content-Type *javascript*
    response_body @js_response {
        search_regexp `(REMOTE_API_URL\s*=\s*)""`
        replace         `$1"{$VK_CLOUD_URL}"`
    }
}
```

**Alternative approach** if the bundled string is harder to match: use `replace` directive to do a simple string substitution on all JS responses:

```caddyfile
response_body @js_response {
    search  `import.meta.env.VITE_VK_SHARED_API_BASE||""`
    replace `"https://vk-cloud.example.com"`
}
```

> **Note:** `response_body` requires the `replace-response` Caddy module. Either build a custom Caddy binary or use `caddy-docker` with the module. Alternatively, use a simple init script that does `sed` on the cached VK frontend assets before Caddy starts.

### 4. Add `VK_SHARED_API_BASE` to local VK environment

In `supervisord.conf`, add the env var to the vibe-kanban program so the Rust backend connects to the cloud:

```ini
environment=HOST="0.0.0.0",PORT="3007",VK_SHARED_API_BASE="%(ENV_VK_CLOUD_URL)s",...
```

In `docker-compose.yaml`, pass it through:
```yaml
environment:
  VK_CLOUD_URL: ${VK_CLOUD_URL:-}
```

This handles the backend half. Combined with step 3, both backend and frontend talk to the cloud.

### 5. Validate the JS rewrite target

Before implementing the Caddy MITM, inspect the actual bundled JS from the npm package to find the exact string pattern to match. Run:

```bash
npx vibe-kanban &
# Find the served JS files and grep for REMOTE_API_URL or VITE_VK_SHARED_API_BASE
```

The Vite build likely tree-shakes `import.meta.env.VITE_VK_SHARED_API_BASE` into a literal empty string `""`. We need to find a unique anchor string near it to do a reliable replacement.

### 6. Summary of changes to vscode-web

| File | Change |
|------|--------|
| `docker-compose.yaml` | Add `VK_CLOUD_URL` env var |
| `supervisord.conf` | Add `VK_SHARED_API_BASE` to vibe-kanban environment |
| `Caddyfile` | Add response body rewrite for JS to inject cloud URL |
| `Dockerfile` | Install Caddy with `replace-response` module (or use sed fallback) |

### 7. Order of operations

1. **Set up GitHub OAuth App** - get client ID/secret, set callback URL
2. **Build & push remote server image** - from Vktest repo
3. **Deploy cloud stack** - postgres + electric + azurite + remote-server + caddy
4. **Verify cloud instance** - hit `https://vk-cloud.example.com`, log in via GitHub OAuth
5. **Inspect local VK JS bundle** - find exact rewrite target string
6. **Update vscode-web** - Caddyfile rewrite + supervisord env + compose env
7. **Test end-to-end** - local VK in vscode-web container connects to cloud, org/project/issue sync works

### 8. Fallback: sed instead of Caddy module

If the Caddy `replace-response` module is problematic, a simpler approach:

Add an init script that runs after `npx vibe-kanban` downloads/caches its assets but before serving, and does a `find + sed` on the cached frontend JS files:

```bash
# In supervisord command, before starting VK:
find /home/vkuser/.vibe-kanban -name '*.js' -exec \
  sed -i 's|REMOTE_API_URL=""|REMOTE_API_URL="'"$VK_CLOUD_URL"'"|g' {} +
```

This is simpler but only runs once (on first download or version change). The backup script already runs before VK starts, so this could slot in there.
