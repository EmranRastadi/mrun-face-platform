#!/usr/bin/env bash
# Periodic host cleanup (run by the LaunchAgent every 15 minutes).
#
# What it removes:
#   - old mrun/* image IDs and all of their tags (scripts/docker-image-gc.sh);
#     the newest image per repo and every image used by a pod are kept
#   - unused Docker build cache
#   - dangling images
#
# It never touches running containers, volumes, or application data. Loki's
# stored logs are pruned separately by Loki's own 15-minute retention policy
# (infrastructure/platform/monitoring/loki/configmap.yaml).
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

cd "$(dirname "$0")/.."

LOG_DIR="${TMPDIR:-/tmp}/mrun-cleanup"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/cleanup.log"

# Keep the log from growing forever too.
if [[ -f "$LOG_FILE" ]] && [[ "$(wc -c < "$LOG_FILE" | tr -d ' ')" -gt 1048576 ]]; then
  tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') cleanup start ==="

  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not reachable; nothing to clean"
    echo "=== cleanup skipped ==="
    exit 0
  fi

  ./scripts/docker-image-gc.sh

  echo "--- pruning unused build cache ---"
  docker builder prune -f >/dev/null

  echo "--- pruning dangling images ---"
  docker image prune -f >/dev/null

  echo "=== cleanup done ==="
} >> "$LOG_FILE" 2>&1
