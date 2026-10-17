import { BaseEvent } from './base.event';
import type { KafkaTopic } from './topics/kafka-topics';

export type NotificationChannel = 'sms' | 'push' | 'email';

export interface NotificationRequestedPayload {
  userId?: string;
  personId?: string;
  channel: NotificationChannel;
  template: string;
  data: Record<string, unknown>;
}

export type NotificationRequestedEvent = BaseEvent<NotificationRequestedPayload>;

export interface NotificationDeliveredPayload {
  notificationId: string;
  channel: NotificationChannel;
  status: 'sent' | 'failed';
  error?: string;
}

export type NotificationDeliveredEvent = BaseEvent<NotificationDeliveredPayload>;

export const NotificationEventNames = {
  NOTIFICATION_REQUESTED: 'notification.requested',
  NOTIFICATION_DELIVERED: 'notification.delivered',
} as const;

export const NotificationTopic: KafkaTopic = 'notification.events';
