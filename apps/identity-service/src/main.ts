import './tracing';
import {
  createMetrics,
  rejectUnsupportedHttpMethods,
} from '@mrun/observability';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Reject HEAD/OPTIONS before routes can answer them.
  app.use(rejectUnsupportedHttpMethods);

  // Prometheus metrics (scraped through the ServiceMonitor on port `http`).
  const metrics = createMetrics('identity-service');
  app.use(metrics.middleware);
  app.getHttpAdapter().get('/metrics', metrics.handler);

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
