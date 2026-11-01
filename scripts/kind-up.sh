#!/usr/bin/env bash
# Creates the kind cluster on a deterministic docker network.
#
# The external-services Endpoints in infrastructure/platform/external-services
# point at the kind network gateway (172.19.0.1). Docker picks the subnet of the
# "kind" bridge network on first use, so pre-creating it with a fixed subnet is
# what makes that IP stable across machines.
set -euo pipefail

cd "$(dirname "$0")/.."

CLUSTER="mrun-face-platform"
NETWORK="kind"
SUBNET="172.19.0.0/16"
GATEWAY="172.19.0.1"

if docker network inspect "$NETWORK" >/dev/null 2>&1; then
  current="$(docker network inspect "$NETWORK" --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}')"
  if [[ "$current" != *"$SUBNET"* ]]; then
    cat >&2 <<EOF
ERROR: docker network "$NETWORK" already exists with subnet "$current", expected $SUBNET.

The manifests under infrastructure/platform/external-services are pinned to
$GATEWAY, so the kind network must use $SUBNET. Recreate the cluster and
network, then re-run this script:

  kind delete cluster --name $CLUSTER
  docker network rm $NETWORK
  ./scripts/kind-up.sh
EOF
    exit 1
  fi
else
  echo "==> Creating docker network $NETWORK ($SUBNET)"
  docker network create --driver=bridge --subnet="$SUBNET" "$NETWORK" >/dev/null
fi

kind create cluster --config kind-config.yaml
