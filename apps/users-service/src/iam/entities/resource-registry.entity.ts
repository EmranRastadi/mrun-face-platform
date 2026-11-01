import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Local projection of resources owned by other services (currently robots).
 * Fed by Kafka (`robot.events`) so the PDP never makes a synchronous
 * cross-service call to authorize a resource.
 */
@Entity('resource_registry')
@Index('idx_resource_registry_org', ['organization_id', 'resource_type'])
export class ResourceRegistryEntry {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  resource_id: string;

  @Column({ type: 'varchar', length: 40 })
  resource_type: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid', nullable: true })
  org_unit_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  model_key: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  capabilities: string[];

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: string;

  @UpdateDateColumn()
  updated_at: Date;
}
