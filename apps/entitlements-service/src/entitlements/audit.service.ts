import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementAudit } from './entitlement-audit.entity';

export interface AuditRecord {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** Append-only trail for commercial changes (plans, subscriptions, overrides). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(EntitlementAudit)
    private readonly audits: Repository<EntitlementAudit>,
  ) {}

  async record(entry: AuditRecord): Promise<void> {
    try {
      await this.audits.save(
        this.audits.create({
          entity_type: entry.entityType,
          entity_id: entry.entityId,
          action: entry.action,
          actor_id: entry.actorId ?? null,
          before_state: entry.before ?? null,
          after_state: entry.after ?? null,
        }),
      );
    } catch (error) {
      // Auditing must never break the commercial operation itself.
      this.logger.error(
        `Failed to write audit entry ${entry.entityType}/${entry.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
