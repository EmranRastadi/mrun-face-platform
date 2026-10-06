import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuditEvent } from '@mrun/events';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { KafkaService } from '../kafka/kafka.service';

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);
  private recent: Record<string, unknown>[] = [];

  constructor(
    private readonly kafka: KafkaService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  onModuleInit() {
    this.kafka.register('audit.events', (event) =>
      this.persistAudit(event as unknown as AuditEvent),
    );
    this.kafka.register('recognition.events', (event) =>
      this.persistRecognition(event),
    );
  }

  private async persistAudit(event: AuditEvent) {
    const payload = event.payload ?? ({} as AuditEvent['payload']);
    const row = {
      event_id: event.eventId,
      event_name: event.eventName,
      actor: payload.actor ?? '',
      action: payload.action ?? '',
      resource_type: payload.resourceType ?? '',
      resource_id: payload.resourceId ?? '',
      outcome: payload.outcome ?? 'success',
      ip: payload.ip ?? '',
      occurred_on: new Date(event.occurredOn)
        .toISOString()
        .replace('T', ' ')
        .replace('Z', ''),
    };
    this.remember(row);
    await this.clickhouse.insert('audit_events', row);
  }

  private async persistRecognition(event: Record<string, unknown>) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const row = {
      event_id: String(event.eventId ?? ''),
      event_name: String(event.eventName ?? 'recognition.completed'),
      actor: 'system',
      action: 'recognition',
      resource_type: 'person',
      resource_id: String(payload.personId ?? ''),
      outcome: payload.matched ? 'success' : 'failure',
      ip: '',
      occurred_on: new Date(String(event.occurredOn ?? Date.now()))
        .toISOString()
        .replace('T', ' ')
        .replace('Z', ''),
    };
    this.remember(row);
    await this.clickhouse.insert('audit_events', row);
  }

  private remember(row: Record<string, unknown>) {
    this.recent.unshift(row);
    this.recent = this.recent.slice(0, 100);
    this.logger.debug(`stored audit event ${row.event_id}`);
  }

  listRecent() {
    return { count: this.recent.length, data: this.recent };
  }
}
