import { Module} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformConfigModule } from './consul';
import { configuration, DatabaseConfig } from './config';
import { validationSchema } from './config';

@Module({
  imports: [
    // PlatformConfigModule,
     ConfigModule.forRoot({
      isGlobal: true,
      // load: [configuration],
      // validationSchema,
    }),

    TypeOrmModule.forRootAsync(DatabaseConfig),
  ],
  providers: []
})
export class AppModule {}