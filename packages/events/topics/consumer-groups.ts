export const ConsumerGroups = {
  RECOGNITION: 'recognition-workers',
  AUDIT: 'audit-workers',
  NOTIFICATION: 'notification-workers',
  ENROLLMENT: 'enrollment-workers',
} as const;

export type ConsumerGroup = (typeof ConsumerGroups)[keyof typeof ConsumerGroups];
