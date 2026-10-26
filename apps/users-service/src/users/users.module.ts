import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { KafkaModule } from '../kafka/kafka.module';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), KafkaModule, SecurityModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}