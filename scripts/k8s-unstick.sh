#!/usr/bin/env bash
# Clear resources stuck in deletion so the next Skaffold deploy does not block
# in `WaitForDeletions` ("waiting for deletion: ... get -f - ...").
#
# Skaffold waits before applying when any resource in the manifest still has a
# deletionTimestamp. In local kind clusters a namespace or PVC can stay
# Terminating forever when its finalizer is held by an already-removed pod/CRD.
# This script clears the finalizer only for `mrun-*` namespaces and PVCs that
# are ALREADY being deleted; it never touches healthy resources.
#
# Runs as the `deploy.kubectl.hooks.before` hook, and can be run manually.
set -euo pipefail

CONTEXT="${KUBE_CONTEXT:-kind-mrun-face-platform}"

# Safety: only auto-force resources in a local kind cluster.
if [[ "$CONTEXT" != kind-* && "${ALLOW_UNSTICK:-0}" != "1" ]]; then
  echo "k8s-unstick: refusing context '$CONTEXT' (set ALLOW_UNSTICK=1 to override)" >&2
  exit 0
fi

if ! kubectl --context "$CONTEXT" get ns >/dev/null 2>&1; then
  echo "k8s-unstick: context '$CONTEXT' unreachable; nothing to do" >&2
  exit 0
fi

# Namespaces already marked for deletion.
kubectl --context "$CONTEXT" get ns \
  -o jsonpath='{range .items[?(@.metadata.deletionTimestamp)]}{.metadata.name}{"\n"}{end}' \
  | grep '^mrun-' \
  | while IFS= read -r ns; do
      echo "k8s-unstick: force-finalizing namespace $ns"
      kubectl --context "$CONTEXT" patch ns "$ns" \
        --type=merge -p '{"metadata":{"finalizers":[]},"spec":{"finalizers":[]}}' >/dev/null 2>&1 || true
    done || true

# PVCs already marked for deletion (pvc-protection finalizer).
kubectl --context "$CONTEXT" get pvc -A \
  -o jsonpath='{range .items[?(@.metadata.deletionTimestamp)]}{.metadata.namespace}/{.metadata.name}{"\n"}{end}' \
  | grep '^mrun-' \
  | while IFS=/ read -r ns name; do
      echo "k8s-unstick: force-finalizing pvc $ns/$name"
      kubectl --context "$CONTEXT" -n "$ns" patch pvc "$name" \
        --type=merge -p '{"metadata":{"finalizers":[]}}' >/dev/null 2>&1 || true
    done || true

exit 0
