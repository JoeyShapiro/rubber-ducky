#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
USERNAME="JoeyShapiro"
IMAGE="rubber-ducky"
VERSION="2.0.1"
# ──────────────────────────────────────────────────────────────────────────────

FULL_IMAGE="${USERNAME}/${IMAGE}"

echo "Building ${FULL_IMAGE}:${VERSION} ..."

docker build \
  --platform linux/amd64 \
  -t "${FULL_IMAGE}:${VERSION}" \
  -t "${FULL_IMAGE}:latest" \
  .

CURRENT_PLATFORM="$(docker info --format '{{.OSType}}/{{.Architecture}}')"
echo "Also tagging for current platform (${CURRENT_PLATFORM}) ..."

docker build \
  --platform "${CURRENT_PLATFORM}" \
  -t "${FULL_IMAGE}:${VERSION}-${CURRENT_PLATFORM//\//-}" \
  .

echo "Logging in to Docker Hub ..."
docker login

echo "Pushing images ..."
docker push "${FULL_IMAGE}:${VERSION}"
docker push "${FULL_IMAGE}:latest"
docker push "${FULL_IMAGE}:${VERSION}-${CURRENT_PLATFORM//\//-}"

echo "Done! Pushed:"
echo "  ${FULL_IMAGE}:${VERSION}"
echo "  ${FULL_IMAGE}:latest"
echo "  ${FULL_IMAGE}:${VERSION}-${CURRENT_PLATFORM//\//-}"
