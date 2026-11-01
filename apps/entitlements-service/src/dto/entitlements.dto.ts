import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  FeatureValueType,
  PlanStatus,
  SubscriptionStatus,
} from '@mrun/contracts';

const FEATURE_KEY = /^[a-z][a-z0-9_.]{2,119}$/;
const PLAN_KEY = /^[a-z][a-z0-9_-]{2,79}$/;

export class CreateFeatureDto {
  @IsString()
  @Matches(FEATURE_KEY, {
    message: 'key must be lowercase dot-separated (e.g. robots.max)',
  })
  key: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(480)
  description?: string;

  @IsEnum(FeatureValueType)
  valueType: FeatureValueType;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}

export class UpdateFeatureDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(480)
  description?: string;

  @IsOptional()
  @IsEnum(FeatureValueType)
  valueType?: FeatureValueType;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}

export class PlanFeatureInputDto {
  @IsString()
  @Matches(FEATURE_KEY)
  featureKey: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limitValue?: number | null;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;
}

export class CreatePlanDto {
  @IsString()
  @Matches(PLAN_KEY)
  key: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(480)
  description?: string;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureInputDto)
  features?: PlanFeatureInputDto[];
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(480)
  description?: string;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class SetPlanFeaturesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureInputDto)
  features: PlanFeatureInputDto[];
}

export class CreateOrganizationSubscriptionDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  planId: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalRef?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateOrganizationSubscriptionDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalRef?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateRobotSubscriptionDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  robotId: string;

  @IsUUID()
  planId: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateEntitlementOverrideDto {
  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  robotId?: string | null;

  @IsString()
  @Matches(FEATURE_KEY)
  featureKey: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limitValue?: number | null;

  @IsString()
  @MinLength(3)
  @MaxLength(480)
  reason: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class EntitlementCheckDto {
  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  robotId?: string | null;

  @IsString()
  @Matches(FEATURE_KEY)
  featureKey: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  quantity?: number;
}

export class ConsumeEntitlementDto extends EntitlementCheckDto {
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string;
}
