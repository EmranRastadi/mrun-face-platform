import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsulService } from './consul';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // const config = app.get(ConfigService);
  app.enableShutdownHooks();
  // console.log(config.get('APP_ENV'));


   const consulService = app.get(ConsulService);
  try {
    await consulService.registerService();
    console.log(`Registered with Consul`);
  } catch (error) {
    console.error(
        'Failed to register with Consul',
        error instanceof Error ? error.stack : String(error),
    );
  }
  await app.listen(3000);
  
  console.log(`Application Listen Port 3000`);
}

bootstrap();
