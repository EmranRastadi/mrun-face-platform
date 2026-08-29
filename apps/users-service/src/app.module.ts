import { Module} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformConfigModule } from './consul';
import {TypeORMConfigService} from "./config/ormconfig.service";
import {UsersModule} from "./users/users.module";
import { AppController } from './app.controller';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
     PlatformConfigModule,
     ConfigModule.forRoot({
      isGlobal: true,
    }),
      KafkaModule,
      TypeOrmModule.forRootAsync({
          useClass: TypeORMConfigService,
          imports: [ConfigModule],
      }),
      UsersModule,

    // TypeOrmModule.forRootAsync(DatabaseConfig),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}