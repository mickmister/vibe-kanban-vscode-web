# vibe-kanban + code-server + Caddy (Docker)

Single-container setup that runs:

- `vibe-kanban` on `3007`
- `code-server` (VS Code in the browser) on `3008`
- `caddy` as the main entrypoint on `3001`

## Quick start

Set a password for `code-server` (required):

```bash
export CODE_PASSWORD='change-me'
```

Build and run:

```bash
docker compose up --build
```

Open:

- `http://localhost:${CADDY_PORT:-3001}` (main entrypoint via Caddy)

## Dynamic port forwarding

Caddy forwards `port-<port>.*` subdomains to `localhost:<port>` inside the container:

- `http://port-12345.localhost:${CADDY_PORT:-3001}/`

## Configuration

Environment variables used by `docker-compose.yaml`:

- `CODE_PASSWORD` (required): sets `PASSWORD` for `code-server`
- `VIBE_KANBAN_VERSION` (optional, default `latest`): version for `vibe-kanban`
- `CADDY_PORT` (optional, default `3001`): host port for Caddy
- `VIBE_KANBAN_PORT` (optional, default `3007`): host port for direct backend access (localhost-only binding)
- `VS_CODE_PORT` (optional, default `3008`): host port for direct code-server access (localhost-only binding)

## GitHub auth

`gh auth login` persists because `/home/vkuser/.config/gh` is a Docker volume. Git HTTPS auth is configured in the image to use GitHub CLI credentials.
