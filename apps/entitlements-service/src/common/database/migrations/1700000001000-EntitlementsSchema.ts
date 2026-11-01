import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plans, subscriptions, overrides and usage accounting.
 *
 * Written with `IF NOT EXISTS` so it is also safe on databases that were
 * previously managed by `synchronize: true` during local development.
 */
export class EntitlementsSchema1700000001000 implements MigrationInterface {
  name = 'EntitlementsSchema1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "features" (
        "key" varchar(120) NOT NULL,
        "name" varchar(160) NOT NULL,
        "description" varchar(480) NOT NULL DEFAULT '',
        "value_type" varchar(16) NOT NULL,
        "unit" varchar(40),
        "category" varchar(60) NOT NULL DEFAULT 'general',
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_features" PRIMARY KEY ("key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_features_category" ON "features" ("category")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plans" (
        "id" uuid NOT NULL,
        "key" varchar(80) NOT NULL,
        "name" varchar(160) NOT NULL,
        "description" varchar(480) NOT NULL DEFAULT '',
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "version" integer NOT NULL DEFAULT 1,
        "is_default" boolean NOT NULL DEFAULT false,
        "trial_days" integer NOT NULL DEFAULT 0,
        "price_monthly" numeric(12,2) NOT NULL DEFAULT 0,
        "currency" varchar(8) NOT NULL DEFAULT 'USD',
        "created_by" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_plans" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_plans_key_version" ON "plans" ("key", "version")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_plans_status" ON "plans" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plan_features" (
        "plan_id" uuid NOT NULL,
        "feature_key" varchar(120) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "limit_value" numeric(18,4),
        "config" jsonb,
        CONSTRAINT "pk_plan_features" PRIMARY KEY ("plan_id", "feature_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_plan_features_feature" ON "plan_features" ("feature_key")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_subscriptions" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "plan_id" uuid NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "seats" integer,
        "starts_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "ends_at" TIMESTAMPTZ,
        "trial_ends_at" TIMESTAMPTZ,
        "canceled_at" TIMESTAMPTZ,
        "external_ref" varchar(160),
        "created_by" integer,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_organization_subscriptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_org_subscriptions_org_status" ON "organization_subscriptions" ("organization_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_org_subscriptions_plan" ON "organization_subscriptions" ("plan_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "robot_subscriptions" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "robot_id" varchar(120) NOT NULL,
        "plan_id" uuid NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "starts_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "ends_at" TIMESTAMPTZ,
        "canceled_at" TIMESTAMPTZ,
        "created_by" integer,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_robot_subscriptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_robot_subscriptions_robot_status" ON "robot_subscriptions" ("robot_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_robot_subscriptions_org" ON "robot_subscriptions" ("organization_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "entitlement_overrides" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "robot_id" varchar(120),
        "feature_key" varchar(120) NOT NULL,
        "enabled" boolean,
        "limit_value" numeric(18,4),
        "reason" varchar(480) NOT NULL DEFAULT '',
        "granted_by" integer,
        "expires_at" TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_entitlement_overrides" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_entitlement_overrides_lookup" ON "entitlement_overrides" ("organization_id", "feature_key", "revoked_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_entitlement_overrides_robot" ON "entitlement_overrides" ("robot_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "usage_counters" (
        "organization_id" uuid NOT NULL,
        "feature_key" varchar(120) NOT NULL,
        "period_start" date NOT NULL,
        "used" bigint NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_usage_counters" PRIMARY KEY ("organization_id", "feature_key", "period_start")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_usage_counters_period" ON "usage_counters" ("period_start")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "usage_consumptions" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "robot_id" varchar(120),
        "feature_key" varchar(120) NOT NULL,
        "period_start" date NOT NULL,
        "amount" integer NOT NULL,
        "idempotency_key" varchar(160),
        "actor_id" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_usage_consumptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_usage_consumptions_lookup" ON "usage_consumptions" ("organization_id", "feature_key", "period_start")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_usage_consumptions_idempotency" ON "usage_consumptions" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "entitlement_audit" (
        "id" uuid NOT NULL,
        "entity_type" varchar(40) NOT NULL,
        "entity_id" varchar(120) NOT NULL,
        "action" varchar(40) NOT NULL,
        "actor_id" integer,
        "before_state" jsonb,
        "after_state" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_entitlement_audit" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_entitlement_audit_entity" ON "entitlement_audit" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_entitlement_audit_created" ON "entitlement_audit" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "entitlement_audit"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "usage_consumptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "usage_counters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "entitlement_overrides"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "robot_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_features"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "features"`);
  }
}
