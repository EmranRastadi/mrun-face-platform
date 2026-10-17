import { BaseEvent } from './base.event';
import type { KafkaTopic } from './topics/kafka-topics';

export interface PersonEnrolledPayload {
  personId: string;
  cardId: string;
  fullName: string;
  imageKey: string;
  embeddingId: string;
  enrolledAt: string;
}

export type PersonEnrolledEvent = BaseEvent<PersonEnrolledPayload>;

export interface EnrollmentRejectedPayload {
  personId: string;
  reason: string;
  imageKey?: string;
}

export type EnrollmentRejectedEvent = BaseEvent<EnrollmentRejectedPayload>;

export const EnrollmentEventNames = {
  PERSON_ENROLLED: 'enrollment.person.enrolled',
  ENROLLMENT_REJECTED: 'enrollment.rejected',
} as const;

export const EnrollmentTopic: KafkaTopic = 'enrollment.events';
