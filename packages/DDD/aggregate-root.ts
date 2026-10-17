import { Entity } from './entity';

export interface DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName: string;
}

export abstract class AggregateRoot<TId = string> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}
