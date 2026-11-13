#!/usr/bin/env bash
# Manual disk cleanup entrypoint. The same work runs automatically every 15
# minutes via ./scripts/install-cleanup-agent.sh and after every
# `skaffold run` (deploy.kubectl.hooks.after in skaffold.yaml).
#
# Retention is per image ID: the newest MRUN_IMAGE_RETAIN image(s) per mrun/*
# repository are kept with all of their tags (including Skaffold's
# input-digest cache tag), and every image used by a pod is kept. Older image
# IDs are deleted. Unused build cache and dangling images are pruned too.
#
#   ./scripts/docker-clean.sh
#   ./scripts/docker-clean.sh --dry-run
#   MRUN_IMAGE_RETAIN=2 ./scripts/docker-clean.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--dry-run" ]]; then
  exec ./scripts/docker-image-gc.sh --dry-run
fi

./scripts/docker-image-gc.sh

echo "==> Pruning unused build cache"
docker builder prune -f

echo "==> Pruning dangling images"
docker image prune -f
