#!/bin/bash
set -e

# Configuration
IMAGE_NAME="${IMAGE_NAME:-vk-cloud}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}VK Cloud - Publish to GitHub Container Registry (using gh CLI)${NC}"
echo "=================================================================="
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: gh CLI is not installed${NC}"
    echo "Install it: https://cli.github.com/"
    exit 1
fi

# Check if authenticated with gh
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub CLI${NC}"
    echo "Please authenticate: gh auth login"
    exit 1
fi

# Get GitHub username from gh CLI
GITHUB_USERNAME=$(gh api user -q .login)
echo -e "${GREEN}GitHub username:${NC} ${GITHUB_USERNAME}"

GHCR_IMAGE="ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"
echo -e "${YELLOW}Image will be published as:${NC} ${GHCR_IMAGE}"
echo ""

# Authenticate Docker with GHCR using gh token
echo -e "${GREEN}Authenticating Docker with GHCR...${NC}"
gh auth token | docker login ghcr.io -u "${GITHUB_USERNAME}" --password-stdin

# Build the image
echo ""
echo -e "${GREEN}Building image...${NC}"
docker compose build vk-remote

# Get the local image name
LOCAL_IMAGE=$(docker compose config | grep -A 5 "vk-remote:" | grep "image:" | awk '{print $2}')
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
echo "Image: ${GHCR_IMAGE}"
echo ""
echo "To use this image in docker-compose.yaml:"
echo ""
echo "  vk-remote:"
echo "    image: ${GHCR_IMAGE}"
echo "    # Remove the 'build:' section"
echo ""
echo "To make the image public, run:"
echo "  gh api --method PATCH /user/packages/container/${IMAGE_NAME}/versions -f visibility=public"
echo ""
echo "Or visit: https://github.com/${GITHUB_USERNAME}?tab=packages"
