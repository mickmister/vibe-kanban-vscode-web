# VK Cloud Self-Hosted Deployment Guide

This guide covers deploying your own Vibe Kanban Cloud instance to connect multiple local VK instances across your team.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ VK Cloud Stack (Self-Hosted)                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │ ElectricSQL  │  │   Azurite    │      │
│  │   (data)     │──│  (realtime)  │  │ (files)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   VK Remote     │                        │
│                   │  Server (API +  │                        │
│                   │    Frontend)    │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐         ┌─────────▼────────┐
     │ Local VK #1     │         │ Local VK #2      │
     │ (code-server +  │   ...   │ (code-server +   │
     │  vibe-kanban)   │         │  vibe-kanban)    │
     └─────────────────┘         └──────────────────┘
```

## Quick Start (Local Testing)

### 1. Configure Environment

```bash
cd vibe-kanban-vscode-web
cp .env.vkcloud.example .env.vkcloud
```

Edit `.env.vkcloud`:

```bash
# Generate JWT secret
VIBEKANBAN_REMOTE_JWT_SECRET=$(openssl rand -base64 32)

# Configure GitHub OAuth (see below)
GITHUB_OAUTH_CLIENT_ID=your_client_id_here
GITHUB_OAUTH_CLIENT_SECRET=your_client_secret_here

# Public URL (for local testing)
PUBLIC_BASE_URL=http://localhost:3000
REMOTE_SERVER_PORTS=127.0.0.1:3000:8081
```

### 2. Create GitHub OAuth App

1. Go to https://github.com/settings/applications/new
2. Fill in:
   - **Application name**: VK Cloud Self-Hosted (Local)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
3. Click "Register application"
4. Copy the **Client ID** to `GITHUB_OAUTH_CLIENT_ID`
5. Generate a new **Client Secret** and copy to `GITHUB_OAUTH_CLIENT_SECRET`

### 3. Start the Cloud Stack

```bash
docker-compose -f docker-compose.vkcloud.yaml up -d
```

First startup will:
- Clone the vibe-kanban repository
- Build the Rust backend (~5-10 minutes)
- Build the React frontend (~2-3 minutes)
- Start PostgreSQL, ElectricSQL, Azurite
- Run database migrations

Monitor progress:
```bash
docker-compose -f docker-compose.vkcloud.yaml logs -f vk-remote
```

### 4. Verify Deployment

Open http://localhost:3000 in your browser. You should see:
- VK Cloud login page
- "Sign in with GitHub" button
- After signing in: empty kanban board

Check health:
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

### 5. Connect Local VK Instances

In your local VK container (vibe-kanban-vscode-web):

```bash
# Edit .env or docker-compose.yaml
VK_CLOUD_URL=http://host.docker.internal:3000

# Restart to pick up the new env var
docker-compose restart
```

Now when you open the local VK at http://localhost:8080, it will connect to your self-hosted cloud at http://localhost:3000.

---

## Production Deployment

### Prerequisites

- A server with Docker & Docker Compose (4GB+ RAM recommended)
- A domain name (e.g., `vk.yourdomain.com`)
- SSL/TLS certificate (Let's Encrypt via Caddy is easiest)

### Option 1: Deploy Behind Reverse Proxy (Recommended)

Use Caddy, Nginx, or Traefik for TLS termination.

**Example Caddyfile**:
```caddy
vk.yourdomain.com {
    reverse_proxy localhost:3000
}
```

**Configure `.env.vkcloud`**:
```bash
PUBLIC_BASE_URL=https://vk.yourdomain.com
REMOTE_SERVER_PORTS=127.0.0.1:3000:8081  # Keep internal, Caddy handles external
```

**GitHub OAuth App**:
- Homepage URL: `https://vk.yourdomain.com`
- Authorization callback URL: `https://vk.yourdomain.com/api/auth/github/callback`

### Option 2: Direct Exposure (Not Recommended)

If you must expose the VK remote server directly without a reverse proxy:

```bash
PUBLIC_BASE_URL=http://your-server-ip:3000
REMOTE_SERVER_PORTS=0.0.0.0:3000:8081  # Expose to all interfaces
```

⚠️ **Security Warning**: This exposes your instance over HTTP. Use a reverse proxy with TLS in production.

### Persistence & Backups

Critical volumes to back up:
```bash
# PostgreSQL (all board/issue data)
docker volume inspect vk-postgres-data

# ElectricSQL sync state
docker volume inspect vk-electric-data

# File attachments (if using Azurite)
docker volume inspect vk-azurite-data
```

**Backup script**:
```bash
#!/bin/bash
# Backup VK Cloud data
docker-compose -f docker-compose.vkcloud.yaml exec -T vk-postgres \
  pg_dump -U remote remote > backup-$(date +%Y%m%d).sql

docker run --rm \
  -v vk-azurite-data:/data \
  -v $(pwd)/backups:/backups \
  alpine tar czf /backups/azurite-$(date +%Y%m%d).tar.gz /data
```

---

## Building & Publishing Custom Image

### Build Standalone Image

```bash
cd vibe-kanban-vscode-web

# Build the image
docker build \
  -f Dockerfile.vkcloud \
  -t ghcr.io/your-org/vk-cloud:latest \
  .

# Test locally
docker run --rm -p 8081:8081 \
  -e GITHUB_OAUTH_CLIENT_ID=... \
  -e GITHUB_OAUTH_CLIENT_SECRET=... \
  -e VIBEKANBAN_REMOTE_JWT_SECRET=... \
  -e SERVER_DATABASE_URL=postgres://remote:remote@host.docker.internal:5433/remote \
  ghcr.io/your-org/vk-cloud:latest
```

### Publish to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push image
docker push ghcr.io/your-org/vk-cloud:latest
```

### Use Published Image

Edit `docker-compose.vkcloud.yaml`:
```yaml
vk-remote:
  image: ghcr.io/your-org/vk-cloud:latest
  # Remove the 'build:' section
```

---

## Customization

### Use Your Fork of vibe-kanban

If you've forked the vibe-kanban repository and made changes:

**In `.env.vkcloud`**:
```bash
VKTEST_REPO_URL=https://github.com/your-org/vibe-kanban.git
VKTEST_BRANCH=your-custom-branch
```

**Or as build args**:
```bash
docker build \
  -f Dockerfile.vkcloud \
  --build-arg VKTEST_REPO_URL=https://github.com/your-org/vibe-kanban.git \
  --build-arg VKTEST_BRANCH=custom-features \
  -t vk-cloud:custom \
  .
```

### Switch to Real Azure Blob Storage

Instead of local Azurite, use Azure:

**In `.env.vkcloud`**:
```bash
AZURE_STORAGE_ACCOUNT_NAME=your_azure_account
AZURE_STORAGE_ACCOUNT_KEY=your_azure_key
AZURE_STORAGE_CONTAINER_NAME=vk-attachments
AZURE_STORAGE_ENDPOINT_URL=https://your_azure_account.blob.core.windows.net
AZURE_STORAGE_PUBLIC_ENDPOINT_URL=https://your_azure_account.blob.core.windows.net
```

**In `docker-compose.vkcloud.yaml`**:
```yaml
# Comment out or remove azurite and azurite-init services
# vk-azurite: ...
# vk-azurite-init: ...
```

---

## Connecting Multiple Local Instances

Each team member runs their own local VK container (vibe-kanban-vscode-web) and connects to the shared cloud.

**On each local instance**:

1. Edit `.env` or `docker-compose.yaml`:
   ```bash
   VK_CLOUD_URL=https://vk.yourdomain.com
   ```

2. Restart the container:
   ```bash
   docker-compose restart
   ```

3. Open local VK (http://localhost:8080)

4. The JavaScript will be rewritten at runtime by Caddy to connect to `https://vk.yourdomain.com` instead of `https://api.vibekanban.com`

5. Sign in with GitHub (same account works across all instances)

6. Each instance maintains its own token storage but shares the same cloud data

---

## Troubleshooting

### Remote server fails to start

**Check logs**:
```bash
docker-compose -f docker-compose.vkcloud.yaml logs vk-remote
```

**Common issues**:
- Missing `GITHUB_OAUTH_CLIENT_ID` or `GITHUB_OAUTH_CLIENT_SECRET`
- Missing `VIBEKANBAN_REMOTE_JWT_SECRET`
- PostgreSQL not ready (wait for health check)

### ElectricSQL fails to connect

ElectricSQL requires:
1. PostgreSQL with `wal_level=logical` ✓ (set in compose)
2. Remote server to complete migrations first ✓ (handled by depends_on)
3. Correct `electric_sync` role password ✓ (matches ELECTRIC_ROLE_PASSWORD)

**Check**:
```bash
docker-compose -f docker-compose.vkcloud.yaml logs vk-electric
```

### OAuth redirect fails

**Verify callback URL**:
- GitHub OAuth App callback: `${PUBLIC_BASE_URL}/api/auth/github/callback`
- Must match exactly (including http/https, port, trailing slash)

**Test manually**:
```bash
curl http://localhost:3000/api/auth/github
# Should redirect to GitHub
```

### Local VK doesn't connect to cloud

**Verify Caddy is rewriting URLs**:
```bash
# Inside the local VK container
docker-compose exec vibe-kanban-vscode-web bash
curl -s http://localhost:3007 | grep -o 'https://api.vibekanban.com'
# Should return nothing if VK_CLOUD_URL is set

# Check Caddy logs
docker-compose logs caddy | grep "vk_rewrite"
```

**Verify environment variable**:
```bash
docker-compose exec vibe-kanban-vscode-web env | grep VK_CLOUD_URL
# Should show your cloud URL
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# VK Remote API
curl http://localhost:3000/health

# PostgreSQL
docker-compose -f docker-compose.vkcloud.yaml exec vk-postgres pg_isready

# ElectricSQL
curl http://localhost:3000/api/electric/health  # proxied through remote server
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.vkcloud.yaml logs -f

# Specific service
docker-compose -f docker-compose.vkcloud.yaml logs -f vk-remote
docker-compose -f docker-compose.vkcloud.yaml logs -f vk-postgres
docker-compose -f docker-compose.vkcloud.yaml logs -f vk-electric
```

### Database Access

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.vkcloud.yaml exec vk-postgres psql -U remote -d remote

# Run SQL query
docker-compose -f docker-compose.vkcloud.yaml exec vk-postgres \
  psql -U remote -d remote -c "SELECT * FROM users;"
```

### Upgrade VK Cloud

```bash
# Pull latest changes (if using git clone in Dockerfile)
docker-compose -f docker-compose.vkcloud.yaml build --no-cache vk-remote

# Or update VKTEST_BRANCH in .env.vkcloud
VKTEST_BRANCH=v2.0.0

# Rebuild and restart
docker-compose -f docker-compose.vkcloud.yaml up -d --build vk-remote
```

---

## Security Checklist

- [ ] Strong `VIBEKANBAN_REMOTE_JWT_SECRET` (32+ random bytes)
- [ ] HTTPS enabled (via reverse proxy)
- [ ] OAuth redirect URLs use HTTPS in production
- [ ] PostgreSQL password changed from default
- [ ] ElectricSQL password changed from default
- [ ] Firewall rules restrict access to PostgreSQL (port 5433)
- [ ] Regular backups configured
- [ ] Update strategy in place for security patches

---

## Cost Considerations

### Self-Hosted (This Setup)

**Required**:
- Server: $5-20/month (DigitalOcean, Linode, Hetzner)
- Domain: $10-15/year

**Optional**:
- Azure Blob Storage: ~$0.02/GB/month (if not using Azurite)

**Total**: ~$5-20/month + minimal storage costs

### Official VK Cloud (vibekanban.com)

Check https://vibekanban.com/pricing for current pricing.

---

## Support

- **Documentation**: See [CLOUD-DEPLOYMENT-RESEARCH.md](CLOUD-DEPLOYMENT-RESEARCH.md) for detailed architecture notes
- **Implementation**: See [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) for Caddy URL rewriting setup
- **Issues**: https://github.com/BloopAI/BloopAI/vibe-kanban/issues
- **License**: Apache 2.0 (self-hosting is fully supported)
