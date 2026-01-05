FROM node:20-bullseye

# Install development tools, supervisor, Caddy, and GitHub CLI
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    supervisor \
    ca-certificates \
    debian-keyring \
    debian-archive-keyring \
    apt-transport-https \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y caddy gh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install code-server using official install script
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Create a non-root user for running applications
RUN useradd -m -s /bin/bash vkuser && \
    mkdir -p /home/vkuser/.local/share/vibe-kanban \
             /home/vkuser/.local/share/pnpm \
             /home/vkuser/.config/code-server \
             /home/vkuser/.config/gh \
             /home/vkuser/.npm \
             /home/vkuser/.cache \
             /home/vkuser/.claude \
             /home/vkuser/repos \
             /var/tmp/vibe-kanban/worktrees && \
    chown -R vkuser:vkuser /home/vkuser && \
    chown -R vkuser:vkuser /var/tmp/vibe-kanban

# Create supervisor log directory
RUN mkdir -p /var/log/supervisor

# Install tools globally as root (will be available system-wide)
RUN npm install -g @anthropic-ai/claude-code pnpm

# Pre-install vibe-kanban at build time (optional, speeds up first start)
ARG VIBE_KANBAN_VERSION="latest"
RUN npm install -g vibe-kanban@"$VIBE_KANBAN_VERSION"

# Create supervisor config directory
RUN mkdir -p /etc/supervisor/conf.d

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy database backup script
COPY backup-vibe-kanban-db.sh /usr/local/bin/backup-vibe-kanban-db.sh
RUN chmod +x /usr/local/bin/backup-vibe-kanban-db.sh

# Copy default VS Code settings
RUN mkdir -p /home/vkuser/.local/share/code-server/User
COPY default-settings.json /home/vkuser/.local/share/code-server/User/settings.json

# Install Claude Code extension
RUN code-server --install-extension anthropic.claude-code

RUN chown -R vkuser:vkuser /home/vkuser/.local

EXPOSE 3001
EXPOSE 3007
EXPOSE 3008

# default supervisord in foreground
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
