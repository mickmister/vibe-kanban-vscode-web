#!/bin/bash
set -e
set -o pipefail
set -x  # Enable verbose command tracing

# Configuration
IMAGE_NAME="${IMAGE_NAME:-vk-cloud}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
VK_BRANCH="${VK_BRANCH:-}"

# Log each step with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}VK Cloud - Publish to GitHub Container Registry (using gh CLI)${NC}"
echo "=================================================================="
echo ""

# Check if gh is installed
log "Checking for gh CLI..."
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: gh CLI is not installed${NC}"
    echo "Install it: https://cli.github.com/"
    exit 1
fi
log "gh CLI found: $(which gh)"

# Check if authenticated with gh
log "Checking gh authentication..."
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub CLI${NC}"
    echo "Please authenticate: gh auth login"
    exit 1
fi
log "gh authentication verified"

if [ -z "${VK_BRANCH}" ]; then
    echo -e "${RED}Error: VK_BRANCH is required${NC}"
    echo "Set VK_BRANCH from the workflow environment."
    exit 1
fi
log "Using VK_BRANCH: ${VK_BRANCH}"

# Resolve GitHub username from GitHub Actions environment
log "Resolving GitHub username from environment..."
GITHUB_USERNAME="${GITHUB_USERNAME:-${GITHUB_REPOSITORY_OWNER:-}}"
if [ -z "${GITHUB_USERNAME}" ]; then
    echo -e "${RED}Error: GITHUB_USERNAME (or GITHUB_REPOSITORY_OWNER) is required${NC}"
    echo "This script is intended to run in GitHub Actions."
    exit 1
fi
echo -e "${GREEN}GitHub username:${NC} ${GITHUB_USERNAME}"
log "Username resolved: ${GITHUB_USERNAME}"

GHCR_IMAGE="ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"
echo -e "${YELLOW}Image will be published as:${NC} ${GHCR_IMAGE}"
echo ""

# Authenticate Docker with GHCR using gh token
log "Authenticating Docker with GHCR..."
echo -e "${GREEN}Authenticating Docker with GHCR...${NC}"
gh auth token | docker login ghcr.io -u "${GITHUB_USERNAME}" --password-stdin
log "Docker authentication complete"

# Build the image using build-specific compose file
echo ""
log "Starting Docker build (this will take 7+ minutes)..."
echo -e "${GREEN}Building image...${NC}"
log "Running: docker compose -f docker-compose.build.yaml build vk-remote"
VK_BRANCH="${VK_BRANCH}" IMAGE_TAG="${IMAGE_TAG}" docker compose -f docker-compose.build.yaml build vk-remote 2>&1 | tee /tmp/vk-build.log
log "Docker build completed"

# Get the local image name
log "Getting local image name..."
LOCAL_IMAGE="vkcloud-vk-remote:${IMAGE_TAG}"
echo -e "${GREEN}Local image:${NC} ${LOCAL_IMAGE}"
log "Local image name: ${LOCAL_IMAGE}"

# Verify the image exists
log "Verifying image exists..."
if ! docker image inspect "${LOCAL_IMAGE}" &> /dev/null; then
    echo -e "${RED}Error: Image ${LOCAL_IMAGE} not found!${NC}"
    echo "Available images:"
    docker images | grep -E "vk-remote|vk-cloud|vkcloud"
    exit 1
fi
log "Image verified: ${LOCAL_IMAGE}"

# Tag the image for GHCR
echo ""
log "Tagging image for GHCR..."
echo -e "${GREEN}Tagging image for GHCR...${NC}"
docker tag "${LOCAL_IMAGE}" "${GHCR_IMAGE}"
log "Tagging complete: ${LOCAL_IMAGE} -> ${GHCR_IMAGE}"

# Push to GHCR
echo ""
log "Pushing image to GHCR (this may take several minutes)..."
echo -e "${GREEN}Pushing to GHCR...${NC}"
docker push "${GHCR_IMAGE}" 2>&1 | tee /tmp/vk-push.log
log "Push complete"

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
