import { BaseEvent } from './base.event';

export interface CardCreatedPayload {
  cardId: string;
  userId: string;
  title: string;
}

export type CardCreatedEvent = BaseEvent<CardCreatedPayload>;

export interface CardUpdatedPayload {
  cardId: string;
  changes: Record<string, unknown>;
}

export type CardUpdatedEvent = BaseEvent<CardUpdatedPayload>;

export const CardEventNames = {
  CARD_CREATED: 'card.created',
  CARD_UPDATED: 'card.updated',
} as const;
