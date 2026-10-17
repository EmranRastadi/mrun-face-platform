#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/4] Applying persistent inotify sysctl settings (sudo password may be prompted)"
echo -e "fs.inotify.max_user_instances=512\nfs.inotify.max_user_watches=524288" | sudo tee /etc/sysctl.d/99-kind.conf >/dev/null
sudo sysctl --system

echo "==> [2/4] Starting docker-compose infra (postgres, kafka, clickhouse, kafka-ui, minio)"
docker compose --profile blob up -d

echo "==> [3/4] Building + deploying to Kubernetes with skaffold"
skaffold run

echo "==> [4/4] Cluster status"
kubectl get pods -n mrun-apps
kubectl get pods -n mrun-system
kubectl get pods -n mrun-security
