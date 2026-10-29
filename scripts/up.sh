#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/5] Applying persistent inotify sysctl settings (Linux only)"
if [[ "$(uname -s)" == "Linux" ]]; then
  echo -e "fs.inotify.max_user_instances=512\nfs.inotify.max_user_watches=524288" | sudo tee /etc/sysctl.d/99-kind.conf >/dev/null
  sudo sysctl --system
else
  echo "    Skipped: Docker Desktop's Linux VM manages these limits on $(uname -s)."
fi

echo "==> [2/5] Starting docker-compose infra (postgres, kafka, clickhouse, kafka-ui, minio)"
docker compose --profile blob up -d

echo "==> [3/5] Installing the monitoring stack (kube-prometheus-stack, Loki, Tempo, Fluent Bit)"
if helm status kube-prometheus-stack -n mrun-monitoring >/dev/null 2>&1; then
  echo "    Already installed — skipping Helm install (re-run 'make monitoring' to upgrade)."
  kubectl apply -k infrastructure/platform/monitoring
else
  ./infrastructure/scripts/install-monitoring.sh
fi

echo "==> [4/5] Building + deploying to Kubernetes with skaffold"
skaffold run

echo "==> [5/5] Cluster status"
kubectl get pods -n mrun-apps
kubectl get pods -n mrun-system
kubectl get pods -n mrun-security
kubectl get pods -n mrun-monitoring
