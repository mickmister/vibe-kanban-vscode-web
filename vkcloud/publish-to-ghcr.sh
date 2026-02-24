#!/bin/bash
set -e

# Configuration
GITHUB_USERNAME="${GITHUB_USERNAME:-}"
IMAGE_NAME="${IMAGE_NAME:-vk-cloud}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
GHCR_IMAGE="ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}VK Cloud - Publish to GitHub Container Registry${NC}"
echo "=================================================="
echo ""

# Check if GITHUB_USERNAME is set
if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}Error: GITHUB_USERNAME is not set${NC}"
    echo "Please set it: export GITHUB_USERNAME=your-github-username"
    exit 1
fi

echo -e "${YELLOW}Image will be published as:${NC} ${GHCR_IMAGE}"
echo ""

# Check if already logged in to GHCR
echo "Checking GHCR authentication..."
if ! docker info 2>/dev/null | grep -q "ghcr.io"; then
    echo -e "${YELLOW}Not authenticated with GHCR${NC}"
    echo ""
    echo "To authenticate, you need a GitHub Personal Access Token with 'write:packages' scope"
    echo "Create one at: https://github.com/settings/tokens/new?scopes=write:packages"
    echo ""
    echo "Then run: echo YOUR_TOKEN | docker login ghcr.io -u ${GITHUB_USERNAME} --password-stdin"
    echo ""
    read -p "Have you authenticated? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build the image using build-specific compose file
echo ""
echo -e "${GREEN}Building image...${NC}"
IMAGE_TAG="${IMAGE_TAG}" docker compose -f docker-compose.build.yaml build vk-remote

# Get the local image name
LOCAL_IMAGE="vkcloud-vk-remote:${IMAGE_TAG}"
echo -e "${GREEN}Local image:${NC} ${LOCAL_IMAGE}"

# Tag the image for GHCR
echo ""
echo -e "${GREEN}Tagging image for GHCR...${NC}"
docker tag "${LOCAL_IMAGE}" "${GHCR_IMAGE}"

# Push to GHCR
echo ""
echo -e "${GREEN}Pushing to GHCR...${NC}"
docker push "${GHCR_IMAGE}"

echo ""
echo -e "${GREEN}✓ Successfully published to GHCR!${NC}"
echo ""
echo "To use this image in docker-compose.yaml:"
echo ""
echo "  vk-remote:"
echo "    image: ${GHCR_IMAGE}"
echo "    # Remove the 'build:' section"
echo ""
echo "To make the image public:"
echo "1. Go to https://github.com/${GITHUB_USERNAME}?tab=packages"
echo "2. Click on '${IMAGE_NAME}'"
echo "3. Click 'Package settings'"
echo "4. Scroll down to 'Danger Zone' and click 'Change visibility'"
echo "5. Select 'Public'"
