

#!/bin/bash
set -eu

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-bullseye

# Install supervisor
RUN apt-get update && apt-get install -y supervisor \
    && mkdir -p /var/log/supervisor

# Install tools
ARG VIBE_KANBAN_VERSION="latest"
RUN npm install -g @anthropic-ai/claude-code \
    && npm install -g vibe-kanban@"$VIBE_KANBAN_VERSION"

# Create supervisor config directory
RUN mkdir -p /etc/supervisor/conf.d

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose any ports (adjust if needed)
EXPOSE 8080
EXPOSE 3000

# default supervisord in foreground
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
EOF

# Supervisor config for two processes
cat > supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log
logfile_maxbytes=50MB
loglevel=info

; code-server
[program:code-server]
command=code-server --bind-addr 0.0.0.0:8080
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/code-server.log
stderr_logfile=/var/log/supervisor/code-server.err.log

; vibe-kanban
[program:vibe-kanban]
; run global install by default; override with env VAR if needed
command=npx vibe-kanban
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/vibe-kanban.log
stderr_logfile=/var/log/supervisor/vibe-kanban.err.log
EOF

echo "Files created: Dockerfile, supervisord.conf"

echo "Build with something like:"
echo "  docker build . -t code-vibe"
echo "Run with:"
echo "  docker run -e VIBE_KANBAN_VERSION=1.2.3 -p 8080:8080 -p 3000:3000 code-vibe"
