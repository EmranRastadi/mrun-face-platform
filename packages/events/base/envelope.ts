export interface Envelope {
  aggregateId: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}