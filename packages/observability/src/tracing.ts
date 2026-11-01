/**
 * OpenTelemetry tracing for mrun services.
 *
 * Call `initTracing()` as the very first import of `main.ts` — before Nest,
 * Express, axios, etc. are loaded — so the auto-instrumentations can patch them.
 *
 * Tracing is opt-in: it is a no-op unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set
 * and `OTEL_ENABLED` is not `"false"`.
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

function otlpBaseUrl(endpoint: string): string {
  return endpoint.replace(/\/+$/, '').replace(/\/v1\/traces$/, '');
}

export interface TracingOptions {
  serviceName: string;
  version?: string;
}

export function initTracing(options: TracingOptions): void {
  if (sdk) return;

  if (process.env.OTEL_ENABLED === 'false') return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;

  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? options.serviceName,
      [ATTR_SERVICE_VERSION]: options.version ?? process.env.SERVICE_VERSION ?? 'unknown',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${otlpBaseUrl(endpoint)}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Way too noisy and not useful in this platform.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Do not register SIGTERM/SIGINT handlers here: Nest's `enableShutdownHooks()`
  // owns graceful shutdown and calls `process.exit()`. We flush explicitly from
  // the SDK's own shutdown hook when the process exits.
  const shutdown = () => {
    sdk?.shutdown().catch(() => undefined);
  };
  process.once('beforeExit', shutdown);
}
