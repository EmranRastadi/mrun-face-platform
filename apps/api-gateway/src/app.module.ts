import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformConfigModule } from './consul';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PlatformConfigModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
