# kube-prometheus-stack

The Prometheus Operator stack (Prometheus + Operator + kube-state-metrics +
node-exporter) is installed with Helm because it owns cluster-scoped CRDs
(`ServiceMonitor`, `PodMonitor`, `PrometheusRule`, ...). Applications still
declare their own `ServiceMonitor` objects through kustomize
(`infrastructure/apps/<service>/servicemonitor.yaml`), so app manifests remain
portable.

## Install

```bash
make monitoring
# or
./infrastructure/scripts/install-monitoring.sh
```

The script also removes the legacy hand-rolled `prometheus`,
`kube-state-metrics` and `node-exporter` workloads that used to live in
`infrastructure/platform/monitoring/`, then re-applies the kustomize-managed
Grafana/Loki/Tempo/Fluent Bit stack.

## What is intentionally disabled

- `grafana.enabled=false` — Grafana is a plain kustomize deployment so its
  dashboards stay in git (`grafana/grafana-dashboards.yaml`).
- `alertmanager.enabled=false` — no on-call rotation is configured yet.
- `kubeEtcd` / `kubeControllerManager` / `kubeScheduler` / `kubeProxy` — not
  reachable from pods on kind.

## Upgrading

Bump `CHART_VERSION` in `infrastructure/scripts/install-monitoring.sh` and
re-run `make monitoring`.
