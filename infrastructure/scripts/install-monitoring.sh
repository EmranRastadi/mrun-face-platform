#!/usr/bin/env bash
set -euo pipefail

# Installs the monitoring platform:
#   1. kube-prometheus-stack (Prometheus Operator + Prometheus + KSM + node-exporter) via Helm
#   2. Grafana / Loki / Tempo / Fluent Bit via kustomize
#
# Grafana and Alertmanager from the chart stay disabled (see the values file).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITORING_DIR="$INFRA_DIR/platform/monitoring"

NAMESPACE="mrun-monitoring"
RELEASE="kube-prometheus-stack"
CHART_VERSION="92.16.1"
VALUES_FILE="$MONITORING_DIR/kube-prometheus-stack/values.yaml"

echo "==> Adding Helm repositories"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update prometheus-community >/dev/null

echo "==> Removing legacy hand-rolled monitoring workloads"
# Replaced by the operator-managed stack. PVCs are kept on purpose so metrics
# history is never destroyed by an install.
kubectl -n "$NAMESPACE" delete deployment prometheus kube-state-metrics --ignore-not-found
kubectl -n "$NAMESPACE" delete daemonset node-exporter --ignore-not-found
kubectl -n "$NAMESPACE" delete service prometheus kube-state-metrics node-exporter --ignore-not-found
kubectl -n "$NAMESPACE" delete configmap prometheus-config --ignore-not-found
kubectl -n "$NAMESPACE" delete serviceaccount prometheus --ignore-not-found
kubectl delete clusterrole mrun-prometheus --ignore-not-found
kubectl delete clusterrolebinding mrun-prometheus --ignore-not-found

echo "==> Installing kube-prometheus-stack $CHART_VERSION"
helm upgrade --install "$RELEASE" prometheus-community/kube-prometheus-stack \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --version "$CHART_VERSION" \
  --values "$VALUES_FILE" \
  --wait \
  --timeout 15m

echo "==> Applying Grafana / Loki / Tempo / Fluent Bit"
kubectl apply -k "$MONITORING_DIR"

echo
echo "Monitoring stack ready."
echo "  Prometheus: http://kube-prometheus-stack-prometheus.$NAMESPACE.svc.cluster.local:9090"
echo "  Grafana:    kubectl -n $NAMESPACE port-forward svc/grafana 3000:3000"
echo "  Loki:       http://loki.$NAMESPACE.svc.cluster.local:3100"
echo "  Tempo:      http://tempo.$NAMESPACE.svc.cluster.local:3200"
