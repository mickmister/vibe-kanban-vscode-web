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

Run `gh auth login` once after first starting the container. Git is pre-configured to use `gh` as the credential helper, so no additional setup is needed.

Credentials persist in the `gh-config` volume at `/home/vkuser/.config/gh`.

To set your Git identity (also persisted):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## Codex auth

Codex caches credentials in `~/.codex/auth.json` when configured for file-based storage; this is persisted via the `codex-data` Docker volume mounted at `/home/vkuser/.codex`.

## Docker-in-Docker support

The container includes Docker CLI and mounts the host's Docker socket at `/var/run/docker.sock`. This allows you to run Docker commands from within the VSCode environment.

**What this means:**
- You can run `docker build`, `docker run`, `docker compose`, etc. from the terminal in VSCode
- Containers you create will run on the host's Docker daemon (not inside this container)
- Images built are stored on the host system
- This approach is more secure than true Docker-in-Docker (no privileged mode required)

**How it works:**
- The container automatically detects the GID of the mounted Docker socket at startup
- The docker group inside the container is created/updated to match the host's docker group GID
- This ensures `vkuser` has permission to access the socket without requiring privileged mode

**Example usage:**
```bash
# Check Docker is available
docker --version

# Build and run containers
docker build -t myapp .
docker run -p 8080:8080 myapp

# Use Docker Compose
docker compose up -d
```

**Security note:** The mounted Docker socket gives this container the ability to create and manage containers on the host. Only use this environment in trusted contexts.

## Increasing inotify limits

If you're working with large projects, you may hit inotify limits (file watcher errors). These are kernel-level settings inherited from the Docker host.

Check current values on the host:

```bash
cat /proc/sys/fs/inotify/max_user_watches    # default: 8192
cat /proc/sys/fs/inotify/max_user_instances  # default: 128
```

To increase (on the Docker host, not in the container):

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
echo fs.inotify.max_user_instances=512 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

No container restart required - changes take effect immediately.
