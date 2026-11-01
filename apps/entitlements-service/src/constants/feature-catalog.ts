import { FeatureValueType, type FeatureDefinition } from '@mrun/contracts';

const f = (
  key: string,
  name: string,
  valueType: FeatureValueType,
  category: string,
  unit: string | null,
  description: string,
): Pick<
  FeatureDefinition,
  'key' | 'name' | 'value_type' | 'unit' | 'category' | 'description'
> => ({ key, name, value_type: valueType, unit, category, description });

/**
 * Features the platform understands. Plans reference these keys; a feature
 * missing from a plan is `feature_not_in_plan`, never implicitly allowed.
 */
export const FEATURE_CATALOG = [
  f('robots.max', 'Maximum robots', FeatureValueType.QUANTITY, 'fleet', 'robots', 'Number of robots the organization may register'),
  f('cameras.max', 'Maximum cameras', FeatureValueType.QUANTITY, 'fleet', 'cameras', 'Number of camera streams the organization may connect'),
  f('users.max', 'Maximum users', FeatureValueType.QUANTITY, 'organization', 'users', 'Number of active user accounts in the organization'),
  f('storage.gb', 'Storage', FeatureValueType.QUANTITY, 'data', 'GB', 'Recorded video and media storage'),
  f('analytics.retention_days', 'Analytics retention', FeatureValueType.QUANTITY, 'data', 'days', 'How long analytics data is retained'),
  f('support.tickets.max', 'Support tickets', FeatureValueType.QUANTITY, 'support', 'tickets', 'Support tickets per billing period'),
  f('support.escalation', 'Support escalation', FeatureValueType.BOOLEAN, 'support', null, 'Escalate tickets to the platform support team'),
  f('repairs.on_site', 'On-site repairs', FeatureValueType.BOOLEAN, 'support', null, 'Request on-site repair visits'),
  f('appointments.booking', 'Service appointments', FeatureValueType.BOOLEAN, 'support', null, 'Book service-center appointments'),
  f('robots.control', 'Remote robot control', FeatureValueType.BOOLEAN, 'fleet', null, 'Send control commands to robots'),
  f('robots.autonomy', 'Autonomous navigation', FeatureValueType.BOOLEAN, 'fleet', null, 'Enable autonomous missions'),
  f('cameras.ai_detection', 'AI detection', FeatureValueType.BOOLEAN, 'vision', null, 'Object and anomaly detection on camera streams'),
  f('analytics.export', 'Analytics export', FeatureValueType.BOOLEAN, 'data', null, 'Export analytics and audit data'),
  f('api.requests_per_month', 'API requests', FeatureValueType.QUANTITY, 'platform', 'requests', 'Monthly API request quota'),
];

export const FEATURE_KEYS = new Set(FEATURE_CATALOG.map((x) => x.key));
