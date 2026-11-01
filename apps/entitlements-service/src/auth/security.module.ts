import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AccessGuard } from './access.guard';
import { AuthzClient } from './authz.client';

/**
 * Authentication/authorization wiring. Registered globally so every controller
 * is protected by default; routes opt out with `@Public()`.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    AuthzClient,
    AccessGuard,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AuthzClient, JwtModule, AccessGuard],
})
export class SecurityModule {}
