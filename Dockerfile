FROM node:20-bullseye

# Install development tools, supervisor, and Caddy
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
    && apt-get update \
    && apt-get install -y caddy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install code-server using official install script
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Create a non-root user for running applications
RUN useradd -m -s /bin/bash vkuser && \
    mkdir -p /home/vkuser/.local/share/ai.bloop.vibe-kanban \
             /home/vkuser/.config/code-server \
             /home/vkuser/.npm \
             /home/vkuser/.cache \
             /home/vkuser/.claude \
             /home/vkuser/repos \
             /var/tmp/vibe-kanban/worktrees && \
    chown -R vkuser:vkuser /home/vkuser && \
    chown -R vkuser:vkuser /var/tmp/vibe-kanban

# Create supervisor log directory
RUN mkdir -p /var/log/supervisor

# Install tools
ARG VIBE_KANBAN_VERSION="latest"
RUN npm install -g @anthropic-ai/claude-code \
    && npm install -g vibe-kanban@"$VIBE_KANBAN_VERSION"

# Create supervisor config directory
RUN mkdir -p /etc/supervisor/conf.d

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

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
