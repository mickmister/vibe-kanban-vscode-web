# Agent Guidelines for vibe-kanban-vscode-web

## Primary Project Focus

When working in the parent directory (`/var/tmp/vibe-kanban/worktrees/d14f-make-code-server/`), **this is the main project to focus on**. Avoid making changes to sibling directories unless explicitly instructed.

### Directory Structure

Parent directory contains:
- **vibe-kanban-vscode-web** ← **PRIMARY PROJECT** (this directory)
- `vibe-kanban/` ← Legacy/reference only
- `Vktest/` ← Testing directory, avoid unless specifically needed

## Working on This Project

### Key Services

1. **code-server** (port 3008)
   - Web-based VS Code editor
   - Configured with 1-hour idle timeout for resource management
   - Auto-restarts on failure via supervisor

2. **vibe-kanban** (port 3007)
   - Task management system
   - Runs database backups before startup
   - Accessible through Caddy reverse proxy

3. **Caddy** (TLS & reverse proxy)
   - Handles HTTPS termination
   - Routes requests to services

4. **test-server** (port 50000)
   - Local test server for port forwarding verification

### Development Workflow

1. Review `supervisord.conf` for process management configuration
2. Check `docker-compose.yaml` for environment and port setup
3. Modify services through supervisor configuration, not direct editing
4. Database changes should be coordinated with backup scripts

### Configuration & Environment

- Environment variables: `.env` (see `.env.example` for template)
- Supervisor: `supervisord.conf`
- Web server: `Caddyfile`
- Code-server settings: `default-settings.json`

### Important: Idle Timeout Management

Code-server automatically shuts down after 1 hour of inactivity to conserve resources. If longer sessions are needed, adjust `--idle-timeout-seconds` in `supervisord.conf` under the `[program:code-server]` section.

## When Making Changes

- Always verify changes don't break process supervision
- Test service startup/restart behavior after config modifications
- Keep resource constraints in mind (idle timeout is for resource efficiency)
- Document any environment variable changes in `.env.example`
