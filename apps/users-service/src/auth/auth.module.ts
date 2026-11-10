import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from './security.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IamModule } from '../iam/iam.module';
import { KeycloakModule } from './keycloak/keycloak.module';

@Module({
  imports: [UsersModule, SecurityModule, IamModule, KeycloakModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
