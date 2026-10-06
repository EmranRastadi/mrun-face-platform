import { BaseEvent } from './base.event';

export interface AuditEventPayload {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  ip?: string;
}

export type AuditEvent = BaseEvent<AuditEventPayload>;

export const AUDIT_TOPIC = 'audit.events';
