// Loaded before Nest so OpenTelemetry can patch Express and pg.
import { initTracing } from '@mrun/observability';

initTracing({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'entitlements-service',
});
