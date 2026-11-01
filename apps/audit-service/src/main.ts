import './tracing';
import { createMetrics } from '@mrun/observability';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, { logger });

  // Prometheus metrics (scraped through the ServiceMonitor on port `http`).
  const metrics = createMetrics('audit-service');
  app.use(metrics.middleware);
  app.getHttpAdapter().get('/metrics', metrics.handler);

  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3003);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MRUN Audit Service')
    .setVersion('1.0.0')
    .build();
  SwaggerModule.setup(
    'api',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(port, '0.0.0.0');
  logger.log(`audit-service running on http://localhost:${port}`);
}

bootstrap();
