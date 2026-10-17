import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

  // CORS
  app.enableCors();

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gateway API')
    .setDescription('Gateway Service API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api', app, swaggerDocument);

  // Config
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3000);

  const userService = configService.get<string>(
    'USERS_SERVICE_URL',
    'http://users-service:3000',
  );

  // Start server
  await app.listen(port, '0.0.0.0');

  try {
    await axios.get(`${userService}/users`);
  } catch (error) {
    logger.warn(
      `Users service not reachable at ${userService}/users`,
      error instanceof Error ? error.message : String(error),
    );
  }

  logger.log(`🚀 Gateway Service is running on: http://localhost:${port}`);

  logger.log(`📘 Swagger: http://localhost:${port}/api`);
}

void bootstrap();
