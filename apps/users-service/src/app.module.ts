import { Module} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { PlatformConfigModule } from './consul';
import {TypeORMConfigService} from "./config/ormconfig.service";
import {UsersModule} from "./users/users.module";

@Module({
  imports: [
     // PlatformConfigModule,
     ConfigModule.forRoot({
      isGlobal: true,
      // load: [configuration],
      // validationSchema,
    }),

      TypeOrmModule.forRootAsync({
          useClass: TypeORMConfigService,
          imports: [ConfigModule],
      }),
      UsersModule,

    // TypeOrmModule.forRootAsync(DatabaseConfig),
  ],
  providers: []
})
export class AppModule {}