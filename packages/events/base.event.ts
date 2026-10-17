export interface BaseEvent<TPayload = unknown> {
  eventId: string;
  eventName: string;
  occurredOn: string;
  aggregateId: string;
  version: number;
  payload: TPayload;
}

export function createEvent<TPayload>(
  eventName: string,
  aggregateId: string,
  payload: TPayload,
): BaseEvent<TPayload> {
  return {
    eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    eventName,
    occurredOn: new Date().toISOString(),
    aggregateId,
    version: 1,
    payload,
  };
}
