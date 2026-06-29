export interface BaseEvent<T> {
  id: string;
  type: string;
  version: number;

  occurredAt: string;

  aggregateId: string;

  correlationId: string;
  causationId?: string;

  producer: string;

  payload: T;
}