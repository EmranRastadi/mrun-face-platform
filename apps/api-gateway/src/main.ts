import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsulService } from './consul';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  app.enableShutdownHooks();
  // Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Filters
  // app.useGlobalFilters(new HttpExceptionFilter());
  // Global Interceptors
  // app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS
  app.enableCors();
  // گرفتن Config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // شروع سرور
  await app.listen(port, '0.0.0.0');

  // ثبت در Consul
  const consulService = app.get(ConsulService);
  try {
    await consulService.registerService();
    logger.log(`Registered with Consul`);
  } catch (error) {
    logger.error(
      'Failed to register with Consul',
      error instanceof Error ? error.stack : String(error),
    );
  }

  logger.log(`🚀 Gateway Service is running on: http://localhost:${port}`);
  logger.log(`📘 Swagger: http://localhost:${port}/api`);
}

bootstrap();
