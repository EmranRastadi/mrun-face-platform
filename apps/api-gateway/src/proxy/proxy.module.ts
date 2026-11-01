import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { EnrollmentProxyController } from './enrollment.controller';
import { AnalyticsProxyController } from './analytics.controller';
import { AuditProxyController } from './audit.controller';
import { NotificationProxyController } from './notification.controller';
import { AuthProxyController } from './auth.controller';
import { CardsProxyController } from './cards.controller';
import { IamProxyController } from './iam.controller';

@Module({
  controllers: [
    EnrollmentProxyController,
    AnalyticsProxyController,
    AuditProxyController,
    NotificationProxyController,
    AuthProxyController,
    CardsProxyController,
    IamProxyController,
  ],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
