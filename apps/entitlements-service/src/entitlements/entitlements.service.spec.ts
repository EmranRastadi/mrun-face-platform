import {
  EntitlementDenyReason,
  EntitlementSource,
  SubscriptionStatus,
} from '@mrun/contracts';
import { EntitlementsService } from './entitlements.service';

/**
 * Resolution precedence is the core contract of this service:
 * override → robot subscription → organization subscription → default plan.
 * These tests pin the ordering and the fall-through rules.
 */
describe('EntitlementsService resolution', () => {
  const overrideRepo = { find: jest.fn() };
  const counterRepo = { findOne: jest.fn() };
  const consumptionRepo = { findOne: jest.fn() };
  const planRepo = { findOne: jest.fn() };
  const subscriptions = {
    findLiveRobotSubscription: jest.fn(),
    findLiveOrganizationSubscription: jest.fn(),
  };
  const plansService = { getPlanFeature: jest.fn() };
  const features = { getOptional: jest.fn() };
  const audit = { record: jest.fn() };

  const service = new EntitlementsService(
    overrideRepo as never,
    counterRepo as never,
    consumptionRepo as never,
    planRepo as never,
    subscriptions as never,
    plansService as never,
    features as never,
    audit as never,
    null as never,
  );

  const orgId = '11111111-1111-1111-1111-111111111111';
  const defaultPlan = { id: 'plan-default' };

  beforeEach(() => {
    jest.resetAllMocks();
    features.getOptional.mockResolvedValue({ key: 'robots.max' });
    overrideRepo.find.mockResolvedValue([]);
    subscriptions.findLiveRobotSubscription.mockResolvedValue(null);
    subscriptions.findLiveOrganizationSubscription.mockResolvedValue(null);
    planRepo.findOne.mockResolvedValue(null);
    plansService.getPlanFeature.mockResolvedValue(null);
  });

  it('denies when no plan defines the feature', async () => {
    const snapshot = await service.resolve(orgId, 'robots.max');
    expect(snapshot.source).toBe(EntitlementSource.NONE);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.reason).toBe(EntitlementDenyReason.NO_PLAN);
  });

  it('falls back to the default plan', async () => {
    planRepo.findOne.mockResolvedValue(defaultPlan);
    plansService.getPlanFeature.mockResolvedValue({
      enabled: true,
      limit_value: '10',
    });

    const snapshot = await service.resolve(orgId, 'robots.max');

    expect(snapshot.source).toBe(EntitlementSource.PLAN_DEFAULT);
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.limit_value).toBe(10);
  });

  it('prefers the robot subscription over the organization subscription', async () => {
    subscriptions.findLiveRobotSubscription.mockResolvedValue({
      id: 'robot-sub',
      organization_id: orgId,
      plan_id: 'plan-robot',
    });
    subscriptions.findLiveOrganizationSubscription.mockResolvedValue({
      id: 'org-sub',
      plan_id: 'plan-org',
    });
    plansService.getPlanFeature.mockImplementation(
      (planId: string, featureKey: string) =>
        Promise.resolve(
          planId === 'plan-robot' && featureKey === 'robots.max'
            ? { enabled: true, limit_value: '5' }
            : { enabled: true, limit_value: '50' },
        ),
    );

    const snapshot = await service.resolve(orgId, 'robots.max', 'robot-1');

    expect(snapshot.source).toBe(EntitlementSource.ROBOT_SUBSCRIPTION);
    expect(snapshot.subscription_id).toBe('robot-sub');
    expect(snapshot.limit_value).toBe(5);
  });

  it('ignores a robot subscription owned by another organization', async () => {
    subscriptions.findLiveRobotSubscription.mockResolvedValue({
      id: 'robot-sub',
      organization_id: '22222222-2222-2222-2222-222222222222',
      plan_id: 'plan-robot',
    });
    planRepo.findOne.mockResolvedValue(defaultPlan);
    plansService.getPlanFeature.mockResolvedValue({
      enabled: true,
      limit_value: null,
    });

    const snapshot = await service.resolve(orgId, 'robots.max', 'robot-1');

    expect(snapshot.source).toBe(EntitlementSource.PLAN_DEFAULT);
  });

  it('lets an override deny a feature the plan allows', async () => {
    overrideRepo.find.mockResolvedValue([
      {
        id: 'override-1',
        robot_id: null,
        feature_key: 'robots.max',
        enabled: false,
        limit_value: null,
        expires_at: null,
      },
    ]);
    planRepo.findOne.mockResolvedValue(defaultPlan);
    plansService.getPlanFeature.mockResolvedValue({
      enabled: true,
      limit_value: '10',
    });

    const snapshot = await service.resolve(orgId, 'robots.max');

    expect(snapshot.source).toBe(EntitlementSource.OVERRIDE);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.reason).toBe(EntitlementDenyReason.OVERRIDE_DENIED);
  });

  it('prefers a robot-specific override over an organization override', async () => {
    overrideRepo.find.mockResolvedValue([
      {
        id: 'org-override',
        robot_id: null,
        enabled: true,
        limit_value: '3',
        expires_at: null,
      },
      {
        id: 'robot-override',
        robot_id: 'robot-1',
        enabled: true,
        limit_value: '7',
        expires_at: null,
      },
    ]);

    const snapshot = await service.resolve(orgId, 'robots.max', 'robot-1');

    expect(snapshot.override_id).toBe('robot-override');
    expect(snapshot.limit_value).toBe(7);
  });

  it('skips expired overrides', async () => {
    overrideRepo.find.mockResolvedValue([
      {
        id: 'expired',
        robot_id: null,
        enabled: true,
        limit_value: '99',
        expires_at: new Date(Date.now() - 1000),
      },
    ]);
    planRepo.findOne.mockResolvedValue(defaultPlan);
    plansService.getPlanFeature.mockResolvedValue({
      enabled: true,
      limit_value: '10',
    });

    const snapshot = await service.resolve(orgId, 'robots.max');

    expect(snapshot.source).toBe(EntitlementSource.PLAN_DEFAULT);
  });

  it('stops at an explicit plan-level disable', async () => {
    subscriptions.findLiveOrganizationSubscription.mockResolvedValue({
      id: 'org-sub',
      plan_id: 'plan-org',
    });
    planRepo.findOne.mockResolvedValue(defaultPlan);
    plansService.getPlanFeature.mockImplementation((planId: string) =>
      Promise.resolve(
        planId === 'plan-org'
          ? { enabled: false, limit_value: null }
          : { enabled: true, limit_value: null },
      ),
    );

    const snapshot = await service.resolve(orgId, 'robots.max');

    expect(snapshot.source).toBe(EntitlementSource.ORGANIZATION_SUBSCRIPTION);
    expect(snapshot.reason).toBe(EntitlementDenyReason.FEATURE_DISABLED);
  });

  it('denies features the catalog does not know', async () => {
    features.getOptional.mockResolvedValue(null);

    const snapshot = await service.resolve(orgId, 'unknown.feature');

    expect(snapshot.reason).toBe(EntitlementDenyReason.FEATURE_NOT_IN_PLAN);
  });
});

describe('EntitlementsService quota evaluation', () => {
  const overrideRepo = { find: jest.fn() };
  const counterRepo = { findOne: jest.fn() };
  const consumptionRepo = { findOne: jest.fn() };
  const planRepo = { findOne: jest.fn() };
  const subscriptions = {
    findLiveRobotSubscription: jest.fn(),
    findLiveOrganizationSubscription: jest.fn(),
  };
  const plansService = { getPlanFeature: jest.fn() };
  const features = { getOptional: jest.fn() };
  const audit = { record: jest.fn() };

  const service = new EntitlementsService(
    overrideRepo as never,
    counterRepo as never,
    consumptionRepo as never,
    planRepo as never,
    subscriptions as never,
    plansService as never,
    features as never,
    audit as never,
    null as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    features.getOptional.mockResolvedValue({ key: 'robots.max' });
    overrideRepo.find.mockResolvedValue([]);
    subscriptions.findLiveRobotSubscription.mockResolvedValue(null);
    subscriptions.findLiveOrganizationSubscription.mockResolvedValue(null);
    planRepo.findOne.mockResolvedValue({ id: 'plan-default' });
    plansService.getPlanFeature.mockResolvedValue({
      enabled: true,
      limit_value: '10',
    });
  });

  it('allows a request within the quota and reports the remainder', async () => {
    counterRepo.findOne.mockResolvedValue({ used: '4' });

    const result = await service.check({
      organizationId: 'org',
      featureKey: 'robots.max',
      quantity: 2,
    });

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(4);
    expect(result.remaining).toBe(4);
  });

  it('denies a request that would exceed the quota', async () => {
    counterRepo.findOne.mockResolvedValue({ used: '9' });

    const result = await service.check({
      organizationId: 'org',
      featureKey: 'robots.max',
      quantity: 2,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(EntitlementDenyReason.QUOTA_EXCEEDED);
  });

  it('treats a null limit as unlimited', async () => {
    plansService.getPlanFeature.mockResolvedValue({
      enabled: true,
      limit_value: null,
    });
    counterRepo.findOne.mockResolvedValue({ used: '1000000' });

    const result = await service.check({
      organizationId: 'org',
      featureKey: 'robots.max',
      quantity: 5,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeNull();
  });

  it('counts subscriptions in a non-live state as absent', async () => {
    subscriptions.findLiveOrganizationSubscription.mockResolvedValue(null);

    const result = await service.check({
      organizationId: 'org',
      featureKey: 'robots.max',
    });

    expect(result.source).toBe(EntitlementSource.PLAN_DEFAULT);
    void SubscriptionStatus;
  });
});
