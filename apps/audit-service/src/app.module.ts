import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { ClickHouseModule } from './clickhouse/clickhouse.module';
import { KafkaModule } from './kafka/kafka.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ClickHouseModule,
    KafkaModule,
    AuditModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
