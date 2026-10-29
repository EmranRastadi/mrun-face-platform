# @mrun/observability

Small, dependency-light building block shared by every NestJS service in this
repo. It provides the two things Prometheus/Tempo need from an application:

- **Metrics** — `prom-client` registry with default process metrics plus
  `http_requests_total` / `http_request_duration_seconds`, served on `/metrics`.
- **Tracing** — OpenTelemetry auto-instrumentation exported over OTLP/HTTP to
  Tempo. Opt-in: no-op unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## Usage

```ts
// main.ts — initTracing MUST run before Nest is imported/patchable libs load.
import { initTracing } from '@mrun/observability';
initTracing({ serviceName: 'users-service', version: '1.0.0' });

import { NestFactory } from '@nestjs/core';
import { createMetrics } from '@mrun/observability';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const metrics = createMetrics('users-service');
  app.use(metrics.middleware);
  app.getHttpAdapter().get('/metrics', metrics.handler);

  await app.listen(3000);
}
```

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | OTLP/HTTP base URL, e.g. `http://tempo.mrun-monitoring.svc.cluster.local:4318`. Unset disables tracing. |
| `OTEL_ENABLED` | `true` | Set to `false` to force-disable tracing. |
| `OTEL_SERVICE_NAME` | `serviceName` argument | Overrides the service name resource attribute. |
| `OTEL_DEBUG` | `false` | Enables the OpenTelemetry diagnostic logger. |
| `SERVICE_VERSION` | `unknown` | Exported as `app_info{version}` and `service.version`. |
