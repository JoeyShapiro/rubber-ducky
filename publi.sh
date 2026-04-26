#!/usr/bin/env bash
set -euo pipefail

bun run build

# ── Configuration ─────────────────────────────────────────────────────────────
USERNAME="joeyshapiro"
IMAGE="rubber-ducky"
VERSION="2.0.1"
# ──────────────────────────────────────────────────────────────────────────────

FULL_IMAGE="docker.io/${USERNAME}/${IMAGE}"

echo "Logging in to Docker Hub ..."
docker login

echo "Building and pushing ${FULL_IMAGE}:${VERSION} (linux/amd64 + linux/arm64) ..."

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --push \
  -t "${FULL_IMAGE}:${VERSION}" \
  -t "${FULL_IMAGE}:latest" \
  .

echo "Done! Pushed:"
echo "  ${FULL_IMAGE}:${VERSION}"
echo "  ${FULL_IMAGE}:latest"
