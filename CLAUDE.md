# vibe-kanban-vscode-web

This is the main project directory for development and deployment. When working in the parent directory, **always focus on this project** and avoid making changes to sibling directories like `vibe-kanban` or `Vktest`.

## Project Overview

vibe-kanban-vscode-web is a containerized development environment that provides:

- **code-server**: Web-based VS Code editor accessible via browser
- **vibe-kanban**: Task management system for tracking work
- **Caddy**: Reverse proxy and TLS termination
- **Supervisor**: Process management to keep services running

## Key Configuration

### Code-Server Idle Timeout
Code-server is configured with an idle timeout of 3600 seconds (1 hour) to automatically shut down unused sessions and prevent resource exhaustion. This is set in `supervisord.conf`:

```
--idle-timeout-seconds=3600
```

When idle for more than 1 hour, the code-server process will be terminated and automatically restarted by supervisor if needed.

## Files & Structure

- `supervisord.conf` - Process supervisor configuration (code-server, vibe-kanban, caddy, test-server)
- `docker-compose.yaml` - Docker Compose configuration for local development
- `Dockerfile` - Container image definition
- `Caddyfile` - Caddy web server configuration
- `backup-vibe-kanban-db.sh` - Database backup script
- `default-settings.json` - Default code-server settings
- `startup.html` - Startup page
- `README.md` - Project documentation

## Development

See `README.md` for setup and usage instructions.
