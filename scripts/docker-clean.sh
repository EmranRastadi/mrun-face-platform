#!/usr/bin/env bash
# Frees Docker disk space without breaking the current deployment or Skaffold's
# artifact cache.
#
# Default (safe) mode removes:
#   - stopped / created containers (old test containers)
#   - dangling (untagged) images from previous builds
#   - mrun/* images tagged with a human tag (git SHA, "-dirty") that no pod uses
#   - build cache entries older than 7 days
#
# Images tagged with a 64-character digest are kept: Skaffold's input-digest
# policy and the deployed pods both reference them, so deleting them would force
# a rebuild on the next `skaffold run`.
#
# Pass --deep to also delete digest-tagged images that no pod uses. That
# reclaims more space, but Skaffold's cache can no longer verify those
# artifacts, so the next `skaffold run` rebuilds every service.
set -euo pipefail

cd "$(dirname "$0")/.."

CONTEXT="kind-mrun-face-platform"
DEEP=0
[[ "${1:-}" == "--deep" ]] && DEEP=1

echo "==> Removing stopped containers"
docker container prune -f

echo "==> Removing dangling images"
docker image prune -f

echo "==> Removing unused mrun/* images from $CONTEXT"
keep_file="$(mktemp)"
trap 'rm -f "$keep_file"' EXIT

kubectl --context "$CONTEXT" get pods -A \
  -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' \
  | sort -u > "$keep_file"

if [[ ! -s "$keep_file" ]]; then
  echo "    no deployed images found (is the cluster up?); skipping image removal" >&2
else
  docker images --format '{{.Repository}}:{{.Tag}}' \
    | grep '^mrun/' \
    | grep -vxF -f "$keep_file" \
    | while IFS= read -r tag; do
        ref="${tag##*:}"
        # 64 hex chars = digest tag (input digest or image ID): keep unless --deep
        if [[ "$DEEP" -eq 0 && "$ref" =~ ^[0-9a-f]{64}$ ]]; then
          continue
        fi
        docker rmi "$tag" >/dev/null 2>&1 && echo "    removed $tag" || true
      done
  echo "    done"
fi

echo "==> Pruning build cache older than 7 days"
docker builder prune -f --filter until=168h

echo
docker system df
