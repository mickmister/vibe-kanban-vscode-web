#!/bin/bash

echo "=== Environment Check ==="
echo "HOME: $HOME"
echo "USER: $USER"
echo "XDG_DATA_HOME: ${XDG_DATA_HOME:-not set}"
echo ""

echo "=== Directory Listing ==="
echo "Contents of ~/.local/share/ai.bloop.vibe-kanban/:"
ls -lah ~/.local/share/ai.bloop.vibe-kanban/ 2>&1 || echo "Directory does not exist"
echo ""

echo "=== Database File Check ==="
if [ -f ~/.local/share/ai.bloop.vibe-kanban/db.sqlite ]; then
    echo "Database file exists:"
    ls -lh ~/.local/share/ai.bloop.vibe-kanban/db.sqlite
    echo "Size: $(du -h ~/.local/share/ai.bloop.vibe-kanban/db.sqlite | cut -f1)"
else
    echo "Database file DOES NOT exist"
fi
echo ""

echo "=== Config File Check ==="
if [ -f ~/.local/share/ai.bloop.vibe-kanban/config.json ]; then
    echo "Config file exists:"
    ls -lh ~/.local/share/ai.bloop.vibe-kanban/config.json
    echo "Contents:"
    cat ~/.local/share/ai.bloop.vibe-kanban/config.json | head -20
else
    echo "Config file DOES NOT exist"
fi
echo ""

echo "=== Version File Check ==="
if [ -f ~/.local/share/ai.bloop.vibe-kanban/.last-vk-version ]; then
    echo "Version file exists:"
    cat ~/.local/share/ai.bloop.vibe-kanban/.last-vk-version
else
    echo "Version file DOES NOT exist"
fi
