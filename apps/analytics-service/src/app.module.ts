import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { ClickHouseModule } from './clickhouse/clickhouse.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ConsulModule } from './consul/consul.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ConsulModule,
    ClickHouseModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
