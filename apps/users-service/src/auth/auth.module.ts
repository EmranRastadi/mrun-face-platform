import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from './security.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule, SecurityModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
