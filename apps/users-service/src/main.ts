import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConsulService } from './consul/consul.service';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';

async function bootstrap() {
  // تنظیم Winston Logger
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

  // Global Pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Global Filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS
  app.enableCors();

  // گرفتن Config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 8000);

  // شروع سرور
  await app.listen(port, '0.0.0.0');

  // ثبت در Consul
  const consulService = app.get(ConsulService);
  await consulService.registerService();

  logger.log(`🚀 User Service is running on: http://localhost:${port}`);
  logger.log(`📘 Swagger: http://localhost:${port}/api`);
}

bootstrap();