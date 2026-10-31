import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { EnrollmentProxyController } from './enrollment.controller';
import { AnalyticsProxyController } from './analytics.controller';
import { AuditProxyController } from './audit.controller';
import { NotificationProxyController } from './notification.controller';
import { AuthProxyController } from './auth.controller';
import { CardsProxyController } from './cards.controller';

@Module({
  controllers: [
    EnrollmentProxyController,
    AnalyticsProxyController,
    AuditProxyController,
    NotificationProxyController,
    AuthProxyController,
    CardsProxyController,
  ],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
