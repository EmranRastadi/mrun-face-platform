import './tracing';
import {
  createMetrics,
  rejectUnsupportedHttpMethods,
} from '@mrun/observability';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
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

  // Reject HEAD/OPTIONS before routes and CORS middleware can answer them.
  app.use(rejectUnsupportedHttpMethods);

  const metrics = createMetrics('entitlements-service');
  app.use(metrics.middleware);
  app.getHttpAdapter().get('/metrics', metrics.handler);

  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`Entitlements service is running on: http://localhost:${port}`);
}

void bootstrap();
