import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformConfigModule } from './consul';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users-service/users.module';
import { ProxyModule } from './proxy/proxy.module';
import { SecurityModule } from './auth-service/security.module';

@Module({
  imports: [
    PlatformConfigModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    SecurityModule,
    UsersModule,
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
