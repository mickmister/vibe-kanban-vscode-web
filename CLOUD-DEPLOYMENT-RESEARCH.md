# Vibe Kanban Cloud/Remote Self-Hosted Deployment Research

## Executive Summary

**Can the cloud version be run the same way as the local version (just env var changes)?**

**No.** The local (`npx vibe-kanban`) and remote/cloud versions are fundamentally different applications:

| Aspect | Local (npm package) | Remote/Cloud |
|--------|-------------------|--------------|
| Binary | `server` | `remote` |
| Database | SQLite (embedded) | PostgreSQL 16 (wal_level=logical) |
| Real-time sync | None | ElectricSQL |
| Authentication | None (localhost-only) | OAuth (GitHub/Google) + JWT |
| File storage | Local filesystem | Azure Blob Storage |
| Frontend | Embedded in binary (rust-embed) | Separate SPA served from `/srv/static` |
| Code crate | `crates/server/` | `crates/remote/` (independent crate) |
| npm package | Published as `vibe-kanban` | **Not published to npm** |

**We need to build from source.** The remote server is a separate Rust binary that is never published to npm. It requires a multi-stage Docker build (frontend + Rust compilation) and depends on PostgreSQL + ElectricSQL as companion services.

---

## Architecture Overview

The remote server is a multi-tenant Axum web server with:
- PostgreSQL for persistence (with logical replication enabled)
- ElectricSQL for real-time client sync via HTTP "shapes"
- OAuth authentication (GitHub and/or Google)
- JWT-based sessions (short-lived access tokens + long-lived refresh tokens)
- Organization/project/membership authorization model
- Azure Blob Storage for file attachments (with Azurite emulator for local dev)
- Optional Cloudflare R2 for code review payloads
- Optional GitHub App integration for PR reviews
- Optional Loops.so for transactional emails
- Optional Stripe billing (behind `vk-billing` feature flag, NOT needed for self-hosted)

### Service Stack (4 containers minimum)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Caddy       │────▶│ remote-server │────▶│  PostgreSQL  │
│  (TLS/proxy) │     │  :8081       │     │  :5432       │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                     │
                            ▼                     │ logical
                     ┌──────────────┐             │ replication
                     │   Azurite    │     ┌───────▼───────┐
                     │  (or Azure)  │     │  ElectricSQL  │
                     │  :10000      │     │  :3000        │
                     └──────────────┘     └───────────────┘
```

---

## Required Environment Variables

### Critical / Server Won't Start Without These

| Variable | Description | Example | Notes |
|----------|-------------|---------|-------|
| `VIBEKANBAN_REMOTE_JWT_SECRET` | Base64-encoded JWT signing secret | `openssl rand -base64 48` | Must decode to >= 32 bytes |
| `SERVER_DATABASE_URL` | PostgreSQL connection string | `postgres://remote:remote@remote-db:5432/remote` | Fallback: `DATABASE_URL` |
| `ELECTRIC_URL` | Internal ElectricSQL endpoint | `http://electric:3000` | Used for shape proxy |
| `ELECTRIC_ROLE_PASSWORD` | Password for `electric_sync` DB role | `your_secure_password` | ElectricSQL uses this for logical replication |
| `SERVER_PUBLIC_BASE_URL` | Public-facing URL of the server | `https://kanban.example.com` | Used for OAuth callbacks, email links |
| `LOOPS_EMAIL_API_KEY` | Loops.so API key for transactional emails | `...` | **Required at runtime** - server crashes without it (despite docker-compose marking it optional). See [Workaround](#loops-email-workaround) |

### OAuth (at least one provider required)

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App client ID | `Iv1.abc123...` |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App client secret | `secret_...` |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID | `123-abc.apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |

**OAuth Callback URLs:**
- GitHub: `{SERVER_PUBLIC_BASE_URL}/v1/oauth/github/callback`
- Google: `{SERVER_PUBLIC_BASE_URL}/v1/oauth/google/callback`

### GitHub OAuth App Setup

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set:
   - **Application name**: Your app name
   - **Homepage URL**: Your `SERVER_PUBLIC_BASE_URL` (e.g. `https://kanban.example.com`)
   - **Authorization callback URL**: `https://kanban.example.com/v1/oauth/github/callback`
4. Copy the Client ID and generate a Client Secret

### Azure Blob Storage (for file attachments)

| Variable | Description | Default |
|----------|-------------|---------|
| `AZURE_STORAGE_ACCOUNT_NAME` | Storage account name | `devstoreaccount1` (Azurite) |
| `AZURE_STORAGE_ACCOUNT_KEY` | Storage account key | Azurite dev key |
| `AZURE_STORAGE_CONTAINER_NAME` | Blob container name | `issue-attachments` |
| `AZURE_STORAGE_ENDPOINT_URL` | Internal endpoint (for server) | `http://azurite:10000/devstoreaccount1` |
| `AZURE_STORAGE_PUBLIC_ENDPOINT_URL` | Public endpoint (for SAS URLs to clients) | `http://localhost:10000/devstoreaccount1` |
| `AZURE_MANAGED_IDENTITY_CLIENT_ID` | Use Entra ID auth instead of SharedKey | _(unset = SharedKey)_ |
| `AZURE_BLOB_PRESIGN_EXPIRY_SECS` | SAS URL expiry | `3600` |

For self-hosting, the Azurite emulator works perfectly. For production, use a real Azure Storage account or any S3-compatible storage.

### Server Networking

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_LISTEN_ADDR` | Bind address:port | `0.0.0.0:8081` |
| `RUST_LOG` | Log level | `info,remote=info` |

### Frontend Build-Time Variables (Vite)

These are **baked into the JavaScript bundle at build time**. To change them, you must rebuild the frontend (or the entire Docker image).

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Base URL for API requests | `""` (same origin) |
| `VITE_APP_BASE_URL` | Base URL for app links (OAuth, invitations) | `window.location.origin` fallback |
| `VITE_PUBLIC_POSTHOG_KEY` | PostHog project key (optional) | _(empty)_ |
| `VITE_PUBLIC_POSTHOG_HOST` | PostHog API host (optional) | _(empty)_ |

**Important**: In the docker-compose, these are passed as runtime env vars (`VITE_APP_BASE_URL`, `VITE_API_BASE_URL`), but since they are Vite build-time variables, they would normally need to be set at build time. The remote server appears to pass these through some mechanism or the compose setup rebuilds the image with these values set.

### Optional Services

#### Cloudflare R2 (for code review payloads)

| Variable | Description |
|----------|-------------|
| `R2_ACCESS_KEY_ID` | R2 access key (empty = disabled) |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_REVIEW_ENDPOINT` | R2 endpoint URL |
| `R2_REVIEW_BUCKET` | R2 bucket name |
| `R2_PRESIGN_EXPIRY_SECS` | Pre-signed URL expiry (default: 3600) |

#### GitHub App (for PR reviews / webhooks)

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | GitHub App numeric ID (empty = disabled) |
| `GITHUB_APP_PRIVATE_KEY` | Base64-encoded PEM private key |
| `GITHUB_APP_WEBHOOK_SECRET` | Webhook signature secret |
| `GITHUB_APP_SLUG` | GitHub App URL slug |

#### Code Review Worker

| Variable | Description |
|----------|-------------|
| `REVIEW_WORKER_BASE_URL` | External review worker URL |
| `REVIEW_DISABLED` | Set to `1` or `true` to disable reviews |

#### Analytics (compile-time)

| Variable | Description | Notes |
|----------|-------------|-------|
| `POSTHOG_API_KEY` | PostHog key | **Build-time** via `option_env!` |
| `POSTHOG_API_ENDPOINT` | PostHog endpoint | **Build-time** via `option_env!` |
| `SENTRY_DSN_REMOTE` | Sentry DSN | **Build-time** via `option_env!` |

#### Stripe Billing (NOT needed for self-hosted)

Only active when built with `--features vk-billing` (requires access to a private git repo).

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_TEAM_SEAT_PRICE_ID` | Price ID |
| `STRIPE_WEBHOOK_SECRET` | Webhook secret |
| `STRIPE_FREE_SEAT_LIMIT` | Free seats (default: 1) |

---

## Loops Email Workaround

The server code at `crates/remote/src/app.rs:83-84` does:
```rust
let api_key = std::env::var("LOOPS_EMAIL_API_KEY")
    .context("LOOPS_EMAIL_API_KEY environment variable is required")?;
```

This will crash the server if the env var is completely unset. However, if set to an empty string (`LOOPS_EMAIL_API_KEY=`), the `std::env::var` call will succeed (returning `""`), and the `LoopsMailer` will be initialized with an empty API key. Email sends will fail silently (HTTP 401 from Loops API) but the server will run fine.

**For self-hosted deployments without email:** Set `LOOPS_EMAIL_API_KEY=""` (empty string, but present).

Alternatively, this would need a source code patch to make the mailer truly optional.

---

## Deployment Strategy: Build from Source

Since the remote server is not published as an npm package, we must build it from source. The existing `crates/remote/Dockerfile` already provides a working multi-stage build.

### Option A: Standalone Docker Image (Recommended)

Build and publish a Docker image containing just the remote server + frontend SPA. Run PostgreSQL, ElectricSQL, and Azurite as separate containers.

**Pros:**
- Clean separation of concerns
- Can use managed PostgreSQL (RDS, Cloud SQL, etc.)
- Matches the upstream architecture exactly
- Easy to update (rebuild image from new tag)

**Cons:**
- Requires managing multiple containers
- More complex docker-compose

### Option B: All-in-One Container

Bundle everything (remote server, PostgreSQL, ElectricSQL, Azurite) into one container using supervisord.

**Pros:**
- Simple deployment (single container)
- Matches our current vibe-kanban-vscode-web pattern

**Cons:**
- Anti-pattern for containerization
- Harder to scale, backup, or debug
- More complex Dockerfile
- PostgreSQL in a container without dedicated management is risky

### Option C: Extend Current vibe-kanban-vscode-web

Add the remote server stack alongside the existing code-server setup.

**Pros:**
- Single deployment unit with IDE + kanban
- Users get the cloud experience with their code editor

**Cons:**
- Very complex container
- Mixing concerns (IDE + database + app server)
- Resource-heavy

### Recommended Approach: Option A

Build a standalone Docker image from the Vktest repo's `crates/remote/Dockerfile`, publish it, and compose it with PostgreSQL + ElectricSQL + Azurite in a multi-service docker-compose.

---

## Example docker-compose.yml for Self-Hosted Deployment

```yaml
# Self-hosted vibe-kanban cloud deployment
services:
  # PostgreSQL with logical replication (required by ElectricSQL)
  postgres:
    image: postgres:16-alpine
    command: ["postgres", "-c", "wal_level=logical"]
    environment:
      POSTGRES_DB: vibekanban
      POSTGRES_USER: vibekanban
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vibekanban -d vibekanban"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s

  # Azure Blob Storage emulator (for file attachments)
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite:latest
    command: "azurite-blob --blobHost 0.0.0.0 --blobPort 10000 --loose --skipApiVersionCheck"
    volumes:
      - azurite-data:/data
    healthcheck:
      test: nc 127.0.0.1 10000 -z
      interval: 1s
      retries: 30

  azurite-init:
    image: mcr.microsoft.com/azure-cli:latest
    depends_on:
      azurite:
        condition: service_healthy
    environment:
      AZURE_STORAGE_CONNECTION_STRING: >-
        DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;
        AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;
        BlobEndpoint=http://azurite:10000/devstoreaccount1;
    entrypoint: /bin/sh
    command:
      - -c
      - |
        set -e
        az storage container create --name issue-attachments 2>/dev/null || true
        az storage cors add --services b --methods GET PUT POST DELETE OPTIONS \
          --origins '*' --allowed-headers '*' --exposed-headers '*' --max-age 3600
        echo "Azurite initialized"

  # Vibe Kanban remote server
  vibekanban:
    image: ${VIBEKANBAN_IMAGE:-vibekanban-remote:latest}
    build:
      context: ../Vktest  # Path to the vibe-kanban repo
      dockerfile: crates/remote/Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      azurite-init:
        condition: service_completed_successfully
    environment:
      # --- Required ---
      SERVER_DATABASE_URL: postgres://vibekanban:${POSTGRES_PASSWORD}@postgres:5432/vibekanban
      VIBEKANBAN_REMOTE_JWT_SECRET: ${VIBEKANBAN_REMOTE_JWT_SECRET:?generate with: openssl rand -base64 48}
      ELECTRIC_URL: http://electric:3000
      ELECTRIC_ROLE_PASSWORD: ${ELECTRIC_ROLE_PASSWORD:?required}
      SERVER_PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:?set to your public URL}
      LOOPS_EMAIL_API_KEY: ${LOOPS_EMAIL_API_KEY:-}  # Set empty to disable emails

      # --- GitHub OAuth ---
      GITHUB_OAUTH_CLIENT_ID: ${GITHUB_OAUTH_CLIENT_ID:?required}
      GITHUB_OAUTH_CLIENT_SECRET: ${GITHUB_OAUTH_CLIENT_SECRET:?required}

      # --- Optional: Google OAuth ---
      GOOGLE_OAUTH_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID:-}
      GOOGLE_OAUTH_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET:-}

      # --- Azure Blob (Azurite defaults) ---
      AZURE_STORAGE_ACCOUNT_NAME: devstoreaccount1
      AZURE_STORAGE_ACCOUNT_KEY: Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
      AZURE_STORAGE_CONTAINER_NAME: issue-attachments
      AZURE_STORAGE_ENDPOINT_URL: http://azurite:10000/devstoreaccount1
      AZURE_STORAGE_PUBLIC_ENDPOINT_URL: ${PUBLIC_BASE_URL:-http://localhost}:10000/devstoreaccount1

      # --- Logging ---
      RUST_LOG: info,remote=info
    ports:
      - "${REMOTE_SERVER_PORTS:-0.0.0.0:8081:8081}"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:8081/health"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  # ElectricSQL (real-time sync engine)
  # MUST start AFTER remote-server because migrations create the electric_sync role
  electric:
    image: electricsql/electric:1.3.3
    restart: on-failure
    environment:
      DATABASE_URL: postgresql://electric_sync:${ELECTRIC_ROLE_PASSWORD}@postgres:5432/vibekanban?sslmode=disable
      AUTH_MODE: insecure
      ELECTRIC_INSECURE: "true"
      ELECTRIC_MANUAL_TABLE_PUBLISHING: "true"
      ELECTRIC_USAGE_REPORTING: "false"
      ELECTRIC_FEATURE_FLAGS: allow_subqueries,tagged_subqueries
    volumes:
      - electric-data:/app/persistent
    depends_on:
      postgres:
        condition: service_healthy
      vibekanban:
        condition: service_healthy

volumes:
  postgres-data:
  azurite-data:
  electric-data:
```

### Example .env file

```env
# --- Required ---
POSTGRES_PASSWORD=change_me_in_production
VIBEKANBAN_REMOTE_JWT_SECRET=  # Generate: openssl rand -base64 48
ELECTRIC_ROLE_PASSWORD=change_me_too
PUBLIC_BASE_URL=https://kanban.example.com

# --- GitHub OAuth App ---
GITHUB_OAUTH_CLIENT_ID=your_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_client_secret

# --- Optional ---
# GOOGLE_OAUTH_CLIENT_ID=
# GOOGLE_OAUTH_CLIENT_SECRET=
# LOOPS_EMAIL_API_KEY=  # Empty = emails disabled (server still runs)

# --- Port mapping ---
# REMOTE_SERVER_PORTS=0.0.0.0:8081:8081
```

---

## Building the Docker Image

### From the Vktest repo (self-hosted, no billing):

```bash
cd Vktest
docker build \
  -f crates/remote/Dockerfile \
  -t vibekanban-remote:latest \
  .
```

The Dockerfile automatically strips the private `billing` crate dependency when `FEATURES` is empty (the default), so no access to private repos is needed.

### Pre-building and Publishing

```bash
# Build
docker build -f crates/remote/Dockerfile -t ghcr.io/your-org/vibekanban-remote:latest .

# Push
docker push ghcr.io/your-org/vibekanban-remote:latest
```

Then reference the published image in docker-compose:
```yaml
vibekanban:
  image: ghcr.io/your-org/vibekanban-remote:latest
```

---

## Key Considerations for Self-Hosting

### 1. Reverse Proxy / TLS

The remote server listens on plain HTTP (port 8081). You need a reverse proxy for TLS. Options:
- **Caddy** (automatic HTTPS with Let's Encrypt) - recommended, already used in vibe-kanban-vscode-web
- Nginx + certbot
- Cloud load balancer (ALB, CloudFlare Tunnel, etc.)

### 2. ElectricSQL Startup Order

ElectricSQL **must start after** the remote server because:
1. The remote server runs PostgreSQL migrations on startup
2. Migrations create the `electric_sync` database role with the specified password
3. ElectricSQL connects using this role for logical replication

The docker-compose `depends_on` with `condition: service_healthy` handles this.

### 3. PostgreSQL Requirements

- **Must** have `wal_level=logical` (set via command flag or `postgresql.conf`)
- The remote server creates a replication role `electric_sync` during migration
- Managed PostgreSQL services (RDS, Cloud SQL) usually support logical replication but may need explicit configuration

### 4. Data Persistence

Critical volumes to persist:
- `postgres-data` - all application data
- `electric-data` - ElectricSQL replication state
- `azurite-data` - file attachments (if using Azurite)

### 5. Azurite vs Real Azure Blob Storage

For production self-hosting, you have two options:
- **Azurite** (included in compose): Free, no external dependencies, but attachments are stored locally
- **Azure Blob Storage**: Durable cloud storage, requires an Azure account
  - Set `AZURE_STORAGE_ACCOUNT_NAME` and `AZURE_STORAGE_ACCOUNT_KEY` to real values
  - Remove/don't start the azurite containers

### 6. VITE_* Variables and Rebuilding

The `VITE_API_BASE_URL` and `VITE_APP_BASE_URL` are **baked into the frontend JavaScript bundle at build time**. If you change `PUBLIC_BASE_URL`, you need to rebuild the Docker image. This is a limitation of Vite's build-time env var injection.

For the upstream docker-compose, the `VITE_*` env vars are set in the remote-server service, which means they're available at runtime but the frontend was already built during the Docker image build. It appears the upstream compose rebuilds the image each time (`up --build`), which catches these changes.

**For a published Docker image**, you would need to either:
- Build the image with the correct `VITE_*` values set as build args
- Add a runtime script that patches the built JS files with the correct URLs (a common pattern for Vite/React apps)
- Use relative URLs (empty string = same origin), which works if the frontend is served from the same domain as the API

### 7. Integrating with vibe-kanban-vscode-web

If you want to keep the code-server + kanban in one deployment, you could:
1. Run the remote stack (postgres, electric, azurite, remote-server) as a separate docker-compose
2. Point the code-server container's Caddy to proxy to the remote-server instead of the local npx version
3. Or run everything in one compose file with the code-server added

---

## Source Files Reference

| Path | Description |
|------|-------------|
| `Vktest/crates/remote/Dockerfile` | Multi-stage Docker build |
| `Vktest/crates/remote/docker-compose.yml` | Full stack compose file |
| `Vktest/crates/remote/README.md` | Setup instructions |
| `Vktest/crates/remote/src/main.rs` | Entry point |
| `Vktest/crates/remote/src/app.rs` | Server initialization, service wiring |
| `Vktest/crates/remote/src/config.rs` | All env var parsing |
| `Vktest/crates/remote/src/state.rs` | AppState struct |
| `Vktest/crates/remote/src/routes/mod.rs` | Router setup, serves SPA from `/srv/static` |
| `Vktest/crates/remote/src/auth/` | OAuth + JWT authentication |
| `Vktest/crates/remote/src/db/` | PostgreSQL queries + migrations |
| `Vktest/crates/remote/src/shapes.rs` | ElectricSQL shape definitions |
| `Vktest/crates/remote/migrations/` | 16 SQL migration files |
