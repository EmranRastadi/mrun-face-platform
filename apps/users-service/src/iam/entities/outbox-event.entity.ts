import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Transactional outbox for reliable event publication. */
@Entity('outbox_events')
@Index('idx_outbox_events_unpublished', ['published_at', 'created_at'])
export class OutboxEvent {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'varchar', length: 60 })
  aggregate_type: string;

  @Column({ type: 'varchar', length: 120 })
  aggregate_id: string;

  @Column({ type: 'varchar', length: 120 })
  event_type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
