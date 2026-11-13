#!/usr/bin/env bash
# Keep the local `mrun/*` image set bounded.
#
# Skaffold's `inputDigest` tag policy builds one image per unique build input and
# tags it with the digest. With `push: false` (kind) Skaffold also tags the same
# image with its image ID and uses that immutable tag in the manifests. So one
# built image normally has two tags:
#
#   mrun/<service>:<64-char input digest>   <- Skaffold build cache key
#   mrun/<service>:<image id>               <- reference used by the pods
#
# Retention is per repository AND per image ID:
#
#   1. every image referenced by a pod/container is always kept (live version),
#   2. the newest MRUN_IMAGE_RETAIN image IDs per repository are kept with ALL
#      of their tags, so the input-digest cache key survives and the next
#      `skaffold run` does not rebuild unchanged services,
#   3. older image IDs are removed (all of their tags).
#
# Because Skaffold re-tags a changed service with a new digest, the previous
# version becomes the "oldest" image and is deleted here, which is exactly what
# keeps the Docker disk usage flat across repeated deploys.
#
# Runs as the `deploy.kubectl.hooks.after` hook in skaffold.yaml, and can be run
# manually.
#
# Usage:
#   ./scripts/docker-image-gc.sh             # enforce retention
#   ./scripts/docker-image-gc.sh --dry-run   # show what would be removed
#   MRUN_IMAGE_RETAIN=2 ./scripts/docker-image-gc.sh
#   MRUN_IMAGE_GC=0 skaffold run             # skip the hook for one run
set -euo pipefail

cd "$(dirname "$0")/.."

CONTEXT="${KUBE_CONTEXT:-kind-mrun-face-platform}"
RETAIN="${MRUN_IMAGE_RETAIN:-1}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

if [[ "${MRUN_IMAGE_GC:-1}" == "0" ]]; then
  echo "==> Image GC disabled (MRUN_IMAGE_GC=0)"
  exit 0
fi

if ! [[ "$RETAIN" =~ ^[0-9]+$ ]] || [[ "$RETAIN" -lt 1 ]]; then
  echo "MRUN_IMAGE_RETAIN must be a positive integer (got: $RETAIN)" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "==> Docker daemon is not reachable; skipping image GC" >&2
  exit 0
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

live_refs="$tmpdir/live-refs"
live_ids="$tmpdir/live-ids"
current_tags="$tmpdir/current-tags"
repos="$tmpdir/repos"
ids="$tmpdir/ids"
tags="$tmpdir/tags"
: > "$live_refs"
: > "$live_ids"
: > "$current_tags"

# 0. Tags Skaffold would use for the current working tree. These are the build
# cache keys it checks on the next `skaffold run`; deleting one forces a
# rebuild even when the image itself is still on disk. `build --dry-run`
# computes the input digests without building anything.
if command -v skaffold >/dev/null 2>&1 && [[ -f skaffold.yaml ]]; then
  skaffold build --dry-run -q 2>/dev/null \
    | grep -o '"tag":"[^"]*"' \
    | sed 's/"tag":"//; s/"$//' > "$current_tags" || true
fi

# 1. Image references that are currently in use.
if kubectl --context "$CONTEXT" get pods -A >/dev/null 2>&1; then
  CLUSTER_OK=1
  kubectl --context "$CONTEXT" get pods -A \
    -o jsonpath='{range .items[*]}{range .spec.initContainers[*]}{.image}{"\n"}{end}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' \
    >> "$live_refs" 2>/dev/null || true
else
  CLUSTER_OK=0
  echo "    cluster context '$CONTEXT' unreachable" >&2
fi
docker ps -a --format '{{.Image}}' >> "$live_refs" 2>/dev/null || true
sort -u -o "$live_refs" "$live_refs"

if [[ "$CLUSTER_OK" -eq 0 && "${ALLOW_UNSAFE_GC:-0}" != "1" ]]; then
  echo "    refusing to delete images without a reachable cluster (set ALLOW_UNSAFE_GC=1 to override)" >&2
  exit 0
fi

# Resolve live references to image IDs. `docker images` reports 12-character
# IDs, so truncate `docker inspect`'s 64-character ID to match. A tag can
# disappear between listing and inspecting, so failures are ignored.
while IFS= read -r ref; do
  [[ -z "$ref" ]] && continue
  id="$(docker inspect --format '{{.Id}}' "$ref" 2>/dev/null | sed 's/^sha256://' | cut -c1-12)" || true
  if [[ -z "${id:-}" ]]; then
    # Skaffold's immutable tag is the 64-character image ID. If the Docker tag
    # was already removed, recover the ID from the reference itself so the
    # running pod still protects its image.
    suffix="${ref##*[@:]}"
    if [[ "$suffix" =~ ^[0-9a-f]{64}$ ]]; then
      id="${suffix:0:12}"
    fi
  fi
  [[ -n "${id:-}" ]] && echo "$id" >> "$live_ids"
done < "$live_refs"
sort -u -o "$live_ids" "$live_ids"

docker images --format '{{.Repository}}' | grep '^mrun/' | sort -u > "$repos"

removed=0
kept=0

while IFS= read -r repo; do
  [[ -z "$repo" ]] && continue

  # Unique image IDs in this repository, newest first.
  docker images --format '{{.ID}}\t{{.CreatedAt}}' "$repo" \
    | sort -u \
    | sort -t$'\t' -k2,2r \
    | awk -F'\t' '!seen[$1]++ {print $1}' > "$ids"

  index=0
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    index=$((index + 1))

    # All tags that point at this image ID.
    docker images --format '{{.ID}}\t{{.Repository}}:{{.Tag}}' "$repo" \
      | awk -F'\t' -v id="$id" '$1 == id {print $2}' > "$tags"

    is_current=0
    if [[ -s "$current_tags" && -s "$tags" ]]; then
      while IFS= read -r ref; do
        if grep -qxF "$ref" "$current_tags"; then
          is_current=1
          break
        fi
      done < "$tags"
    fi

    # Keep an image ID if a pod/container uses it, or if it is the build Skaffold
    # will reuse. If Skaffold could not compute tags, fall back to keeping the
    # newest MRUN_IMAGE_RETAIN image IDs.
    if grep -qxF "$id" "$live_ids"; then
      kept=$((kept + 1))
      continue
    fi
    if [[ -s "$current_tags" ]]; then
      if [[ "$is_current" -eq 1 ]]; then
        kept=$((kept + 1))
        continue
      fi
    elif [[ "$index" -le "$RETAIN" ]]; then
      kept=$((kept + 1))
      continue
    fi

    if [[ ! -s "$tags" ]]; then
      # Dangling image (no tags left): remove it by ID.
      if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "    would remove $repo@$id"
        removed=$((removed + 1))
      elif docker rmi "$id" >/dev/null 2>&1; then
        echo "    removed $repo@$id"
        removed=$((removed + 1))
      fi
      continue
    fi

    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "    would remove $ref"
        removed=$((removed + 1))
      elif docker rmi "$ref" >/dev/null 2>&1; then
        echo "    removed $ref"
        removed=$((removed + 1))
      else
        echo "    kept $ref (in use)"
        kept=$((kept + 1))
      fi
    done < "$tags"
  done < "$ids"
done < "$repos"

echo "==> Image GC done (newest $RETAIN image(s) per repo + live images; removed $removed tag(s), kept $kept)"
