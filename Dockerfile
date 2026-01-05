FROM node:20-bullseye

# Install development tools and supervisor
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    supervisor \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install code-server globally via npm
RUN npm install -g code-server

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

# Expose any ports (adjust if needed)
EXPOSE 8080
EXPOSE 3000

# default supervisord in foreground
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
