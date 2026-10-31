// Loaded before Nest (and Express/axios) so OpenTelemetry can patch them.
import { initTracing } from '@mrun/observability';

initTracing({ serviceName: process.env.OTEL_SERVICE_NAME ?? 'analytics-service' });
