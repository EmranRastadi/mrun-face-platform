import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { RoleAssignment } from '../iam/entities/role-assignment.entity';
import { Role } from '../iam/entities/role.entity';
import { KafkaModule } from '../kafka/kafka.module';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, RoleAssignment, Role]), KafkaModule, SecurityModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}