import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformConfigModule } from './consul';
import { TypeORMConfigService } from './config/ormconfig.service';
import { SecurityModule } from './auth/security.module';
import { AppController } from './app.controller';

import { Feature } from './features/feature.entity';
import { FeaturesService } from './features/features.service';
import { FeaturesController } from './features/features.controller';

import { Plan } from './plans/plan.entity';
import { PlanFeature } from './plans/plan-feature.entity';
import { PlansService } from './plans/plans.service';
import { PlansController } from './plans/plans.controller';

import { OrganizationSubscription } from './subscriptions/organization-subscription.entity';
import { RobotSubscription } from './subscriptions/robot-subscription.entity';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import {
  RobotSubscriptionsController,
  SubscriptionsController,
} from './subscriptions/subscriptions.controller';

import { EntitlementOverride } from './entitlements/entitlement-override.entity';
import { UsageCounter } from './entitlements/usage-counter.entity';
import { UsageConsumption } from './entitlements/usage-consumption.entity';
import { EntitlementAudit } from './entitlements/entitlement-audit.entity';
import { AuditService } from './entitlements/audit.service';
import { EntitlementsService } from './entitlements/entitlements.service';
import {
  EntitlementOverridesController,
  EntitlementsController,
} from './entitlements/entitlements.controller';

import { EntitlementsSeedService } from './seed/entitlements-seed.service';

const ENTITIES = [
  Feature,
  Plan,
  PlanFeature,
  OrganizationSubscription,
  RobotSubscription,
  EntitlementOverride,
  UsageCounter,
  UsageConsumption,
  EntitlementAudit,
];

@Module({
  imports: [
    PlatformConfigModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useClass: TypeORMConfigService,
      imports: [ConfigModule],
    }),
    TypeOrmModule.forFeature(ENTITIES),
    SecurityModule,
  ],
  controllers: [
    AppController,
    FeaturesController,
    PlansController,
    SubscriptionsController,
    RobotSubscriptionsController,
    EntitlementsController,
    EntitlementOverridesController,
  ],
  providers: [
    FeaturesService,
    PlansService,
    SubscriptionsService,
    AuditService,
    EntitlementsService,
    EntitlementsSeedService,
  ],
  exports: [FeaturesService, PlansService, SubscriptionsService, EntitlementsService],
})
export class AppModule {}
