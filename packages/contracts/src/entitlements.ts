/**
 * Subscription / entitlement contracts.
 *
 * Resolution precedence (highest first):
 *   1. audited override
 *   2. robot subscription
 *   3. organization subscription
 *   4. default plan
 *   5. deny
 */
export enum FeatureValueType {
  BOOLEAN = 'boolean',
  QUANTITY = 'quantity',
  ENUM = 'enum',
  STRING = 'string',
  JSON = 'json',
}

export enum PlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  RETIRED = 'retired',
}

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  SUSPENDED = 'suspended',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

export enum SubscriptionSubject {
  ORGANIZATION = 'organization',
  ROBOT = 'robot',
}

export enum EntitlementSource {
  OVERRIDE = 'override',
  ROBOT_SUBSCRIPTION = 'robot_subscription',
  ORGANIZATION_SUBSCRIPTION = 'organization_subscription',
  PLAN_DEFAULT = 'plan_default',
  NONE = 'none',
}

export enum EntitlementDenyReason {
  NO_PLAN = 'no_plan',
  FEATURE_NOT_IN_PLAN = 'feature_not_in_plan',
  FEATURE_DISABLED = 'feature_disabled',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SUBSCRIPTION_INACTIVE = 'subscription_inactive',
  OVERRIDE_DENIED = 'override_denied',
}

export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  value_type: FeatureValueType;
  unit: string | null;
  category: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanFeature {
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
  config: Record<string, unknown> | null;
}

export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  version: number;
  is_default: boolean;
  trial_days: number;
  price_monthly: number | null;
  currency: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  seats: number | null;
  starts_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
  external_ref: string | null;
  created_by: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RobotSubscription {
  id: string;
  organization_id: string;
  robot_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  canceled_at: string | null;
  created_by: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EntitlementOverride {
  id: string;
  organization_id: string;
  robot_id: string | null;
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
  reason: string;
  granted_by: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface EntitlementSnapshot {
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
  source: EntitlementSource;
  reason: EntitlementDenyReason | null;
  subscription_id: string | null;
  override_id: string | null;
  expires_at: string | null;
}

export interface EntitlementCheckResult extends EntitlementSnapshot {
  allowed: boolean;
  requested: number;
  used: number;
  remaining: number | null;
  period_start: string;
}

export interface UsageSnapshot {
  feature_key: string;
  period_start: string;
  used: number;
  limit_value: number | null;
  remaining: number | null;
}

export interface CreateFeaturePayload {
  key: string;
  name: string;
  description?: string;
  valueType: FeatureValueType;
  unit?: string | null;
  category?: string;
}

export interface CreatePlanPayload {
  key: string;
  name: string;
  description?: string;
  status?: PlanStatus;
  isDefault?: boolean;
  trialDays?: number;
  priceMonthly?: number | null;
  currency?: string;
  features?: Array<{
    featureKey: string;
    enabled?: boolean;
    limitValue?: number | null;
    config?: Record<string, unknown> | null;
  }>;
}

export interface UpdatePlanPayload {
  name?: string;
  description?: string;
  status?: PlanStatus;
  isDefault?: boolean;
  trialDays?: number;
  priceMonthly?: number | null;
  currency?: string;
}

export interface SetPlanFeaturesPayload {
  features: Array<{
    featureKey: string;
    enabled?: boolean;
    limitValue?: number | null;
    config?: Record<string, unknown> | null;
  }>;
}

export interface CreateOrganizationSubscriptionPayload {
  organizationId: string;
  planId: string;
  status?: SubscriptionStatus;
  seats?: number | null;
  startsAt?: string;
  endsAt?: string | null;
  trialEndsAt?: string | null;
  externalRef?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateRobotSubscriptionPayload {
  organizationId: string;
  robotId: string;
  planId: string;
  status?: SubscriptionStatus;
  startsAt?: string;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateEntitlementOverridePayload {
  organizationId: string;
  robotId?: string | null;
  featureKey: string;
  enabled: boolean;
  limitValue?: number | null;
  reason: string;
  expiresAt?: string | null;
}

export interface EntitlementCheckPayload {
  organizationId: string;
  robotId?: string | null;
  featureKey: string;
  quantity?: number;
}

export interface ConsumeEntitlementPayload extends EntitlementCheckPayload {
  amount: number;
  idempotencyKey?: string;
}
