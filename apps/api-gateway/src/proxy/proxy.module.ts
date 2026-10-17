import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { EnrollmentProxyController } from './enrollment.controller';
import { AnalyticsProxyController } from './analytics.controller';
import { AuditProxyController } from './audit.controller';
import { NotificationProxyController } from './notification.controller';

@Module({
  controllers: [
    EnrollmentProxyController,
    AnalyticsProxyController,
    AuditProxyController,
    NotificationProxyController,
  ],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
