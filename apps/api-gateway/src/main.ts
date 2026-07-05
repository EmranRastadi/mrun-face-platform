import { ConfigService } from '@nestjs/config';
import {NestFactory} from "@nestjs/core";
import {AppModule} from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // const config = app.get(ConfigService);
  app.enableShutdownHooks();
  // console.log(config.get('APP_ENV'));

  await app.listen(3000);
}

bootstrap();