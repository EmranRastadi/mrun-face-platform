import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
// import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ConsulService } from './consul';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';

async function bootstrap() {
  // تنظیم Winston Logger
  // const logger = WinstonModule.createLogger({
  //   transports: [
  //     new winston.transports.Console({
  //       format: winston.format.combine(
  //         winston.format.timestamp(),
  //         winston.format.json(),
  //       ),
  //     }),
  //   ],
  // });

  // const app = await NestFactory.create(AppModule, { logger });

  // // Global Pipes
  // app.useGlobalPipes(new ValidationPipe({
  //   whitelist: true,
  //   transform: true,
  //   forbidNonWhitelisted: true,
  // }));

  // // Global Filters
  // // app.useGlobalFilters(new HttpExceptionFilter());

  // // Global Interceptors
  // // app.useGlobalInterceptors(new LoggingInterceptor());

  // // CORS
  // app.enableCors();

  // // گرفتن Config
  // // const configService = app.get(ConfigService);
  // // const port = configService.get<number>('PORT', 3000);
  // const port = 3000;

  // // شروع سرور
  // await app.listen(port, '0.0.0.0');

  // // ثبت در Consul
  // const consulService = app.get(ConsulService);
  // await consulService.registerService();

  // logger.log(`🚀 User Service is running on: http://localhost:${port}`);
  // logger.log(`📘 Swagger: http://localhost:${port}/api`);


  console.log('1. Bootstrap started');

  const app = await NestFactory.create(AppModule);
  console.log('2. Nest app created');

  const configService = app.get(ConfigService);
  console.log('3. Config loaded');

  const port = configService.get<number>('PORT', 3000);

  console.log('4. About to listen on', port);

  await app.listen(port, '0.0.0.0');

  console.log('5. Server is listening');

  const consulService = app.get(ConsulService);

  console.log('6. Registering Consul');

  await consulService.registerService();

  console.log('7. Finished');
}

bootstrap();