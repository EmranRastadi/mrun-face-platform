import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { ClickHouseModule } from './clickhouse/clickhouse.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ClickHouseModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
