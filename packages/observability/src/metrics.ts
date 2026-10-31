/**
 * Prometheus metrics for mrun NestJS services.
 *
 * Exposes:
 *   - default Node.js process metrics (CPU, event loop, heap, GC, ...)
 *   - `http_requests_total` counter and `http_request_duration_seconds` histogram
 *   - `app_info` gauge carrying the service name/version
 *
 * Mount the returned handler on `/metrics` and let Prometheus scrape it through
 * the ServiceMonitor shipped with every app (`infrastructure/apps/<svc>/servicemonitor.yaml`).
 */
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

export interface AppMetrics {
  registry: Registry;
  /** Express-compatible middleware recording request count + latency. */
  middleware: (req: any, res: any, next: () => void) => void;
  /** Express-compatible handler rendering the Prometheus text exposition. */
  handler: (req: any, res: any) => Promise<void>;
}

const LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

function routeLabel(req: any): string {
  // `req.route` is only populated once Express has matched the route, which is
  // exactly what we want (keeps cardinality bounded, no raw IDs in labels).
  const route = req.route?.path;
  const base = req.baseUrl ?? '';
  return route ? `${base}${route}`.replace(/\/+/g, '/') : 'unmatched';
}

export function createMetrics(serviceName: string): AppMetrics {
  const registry = new Registry();

  registry.setDefaultLabels({
    service: serviceName,
    pod: process.env.HOSTNAME ?? 'unknown',
  });

  collectDefaultMetrics({ register: registry });

  new Gauge({
    name: 'app_info',
    help: 'Static information about the running application.',
    labelNames: ['version'],
    registers: [registry],
  }).set(
    { version: process.env.SERVICE_VERSION ?? 'unknown' },
    1,
  );

  const requests = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests handled.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });

  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: LATENCY_BUCKETS,
    registers: [registry],
  });

  const middleware = (req: any, res: any, next: () => void): void => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const labels = {
        method: req.method,
        route: routeLabel(req),
        status_code: String(res.statusCode),
      };
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;

      requests.inc(labels);
      duration.observe(labels, seconds);
    });

    next();
  };

  const handler = async (_req: any, res: any): Promise<void> => {
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  };

  return { registry, middleware, handler };
}
