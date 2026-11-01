import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enterprise IAM schema: organizations, org units, RBAC, ABAC policies,
 * resource registry, principal versions and the transactional outbox.
 *
 * The statements are idempotent (`IF NOT EXISTS`) so they are safe on both a
 * brand-new database and a database that was previously created by
 * `synchronize: true`.
 */
export class IamSchema1700000000000 implements MigrationInterface {
  name = 'IamSchema1700000000000';

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Children first, then the roots.
    await queryRunner.query('DROP TABLE IF EXISTS "outbox_events"');
    await queryRunner.query('DROP TABLE IF EXISTS "principal_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "resource_registry"');
    await queryRunner.query('DROP TABLE IF EXISTS "authorization_policies"');
    await queryRunner.query('DROP TABLE IF EXISTS "resource_grants"');
    await queryRunner.query('DROP TABLE IF EXISTS "role_assignments"');
    await queryRunner.query('DROP TABLE IF EXISTS "role_permission_groups"');
    await queryRunner.query('DROP TABLE IF EXISTS "role_permissions"');
    await queryRunner.query('DROP TABLE IF EXISTS "roles"');
    await queryRunner.query('DROP TABLE IF EXISTS "org_unit_members"');
    await queryRunner.query('DROP TABLE IF EXISTS "org_units"');
    await queryRunner.query('DROP TABLE IF EXISTS "org_memberships"');
    await queryRunner.query('DROP TABLE IF EXISTS "permission_group_items"');
    await queryRunner.query('DROP TABLE IF EXISTS "permission_groups"');
    await queryRunner.query('DROP TABLE IF EXISTS "organizations"');
    await queryRunner.query('DROP TABLE IF EXISTS "permissions"');
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The legacy user table is created by synchronize in existing deployments.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial NOT NULL,
        "username" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "full_name" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "role" character varying(20) NOT NULL DEFAULT 'viewer',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid NOT NULL,
        "kind" character varying(20) NOT NULL,
        "slug" character varying(80) NOT NULL,
        "name" character varying(160) NOT NULL,
        "parent_id" uuid,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "timezone" character varying(64) NOT NULL DEFAULT 'UTC',
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_organizations_slug" ON "organizations" ("slug")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_organizations_kind_status" ON "organizations" ("kind", "status")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_memberships" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "title" character varying(120),
        "employee_no" character varying(80),
        "is_primary" boolean NOT NULL DEFAULT false,
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        "left_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_org_memberships_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_memberships_org_user" ON "org_memberships" ("organization_id", "user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_org_memberships_user" ON "org_memberships" ("user_id", "status")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_units" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "parent_id" uuid,
        "kind" character varying(20) NOT NULL,
        "name" character varying(160) NOT NULL,
        "code" character varying(60),
        "path" text NOT NULL DEFAULT '',
        "depth" integer NOT NULL DEFAULT 0,
        "manager_user_id" integer,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_units_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_org_units_org_parent" ON "org_units" ("organization_id", "parent_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_org_units_path" ON "org_units" ("path")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_unit_members" (
        "id" uuid NOT NULL,
        "org_unit_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        "is_lead" boolean NOT NULL DEFAULT false,
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        "left_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_org_unit_members_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_unit_members" ON "org_unit_members" ("org_unit_id", "user_id")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "key" character varying(96) NOT NULL,
        "resource" character varying(48) NOT NULL,
        "action" character varying(48) NOT NULL,
        "description" character varying(240) NOT NULL,
        "tier" character varying(16) NOT NULL,
        "is_system" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_permissions_key" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permission_groups" (
        "id" uuid NOT NULL,
        "organization_id" uuid,
        "key" character varying(80) NOT NULL,
        "name" character varying(160) NOT NULL,
        "description" character varying(240) NOT NULL DEFAULT '',
        "is_system" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_permission_groups_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_permission_groups_org_key" UNIQUE ("organization_id", "key")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_permission_groups_org" ON "permission_groups" ("organization_id")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permission_group_items" (
        "group_id" uuid NOT NULL,
        "permission_key" character varying(96) NOT NULL,
        CONSTRAINT "PK_permission_group_items" PRIMARY KEY ("group_id", "permission_key")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_permission_group_items_permission" ON "permission_group_items" ("permission_key")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid NOT NULL,
        "organization_id" uuid,
        "key" character varying(80) NOT NULL,
        "name" character varying(160) NOT NULL,
        "description" character varying(240),
        "kind" character varying(16) NOT NULL DEFAULT 'custom',
        "is_assignable" boolean NOT NULL DEFAULT true,
        "created_by" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_roles_org_key" ON "roles" ("organization_id", "key") WHERE "organization_id" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_roles_system_key" ON "roles" ("key") WHERE "organization_id" IS NULL',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_key" character varying(96) NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_key")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_role_permissions_permission" ON "role_permissions" ("permission_key")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permission_groups" (
        "role_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        CONSTRAINT "PK_role_permission_groups" PRIMARY KEY ("role_id", "group_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_role_permission_groups_group" ON "role_permission_groups" ("group_id")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_assignments" (
        "id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        "role_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "scope_type" character varying(20) NOT NULL,
        "scope_id" uuid,
        "status" character varying(16) NOT NULL DEFAULT 'active',
        "granted_by" integer,
        "granted_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "reason" character varying(240),
        CONSTRAINT "PK_role_assignments_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_role_assignments_user_status" ON "role_assignments" ("user_id", "status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_role_assignments_scope" ON "role_assignments" ("organization_id", "scope_type", "scope_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_role_assignments_role" ON "role_assignments" ("role_id")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_grants" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "resource_type" character varying(40) NOT NULL,
        "resource_id" character varying(120) NOT NULL,
        "subject_type" character varying(16) NOT NULL,
        "subject_id" character varying(120) NOT NULL,
        "permission_key" character varying(96) NOT NULL,
        "effect" character varying(8) NOT NULL DEFAULT 'allow',
        "granted_by" integer,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resource_grants_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_resource_grants_resource" ON "resource_grants" ("resource_type", "resource_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_resource_grants_org" ON "resource_grants" ("organization_id")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "authorization_policies" (
        "id" uuid NOT NULL,
        "organization_id" uuid,
        "permission_key" character varying(96) NOT NULL,
        "effect" character varying(8) NOT NULL DEFAULT 'deny',
        "priority" integer NOT NULL DEFAULT 0,
        "condition" jsonb NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "description" character varying(240) NOT NULL DEFAULT '',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_authorization_policies_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_authorization_policies_permission" ON "authorization_policies" ("permission_key", "enabled")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_registry" (
        "resource_id" character varying(120) NOT NULL,
        "resource_type" character varying(40) NOT NULL,
        "organization_id" uuid NOT NULL,
        "org_unit_id" uuid,
        "model_key" character varying(80),
        "capabilities" text[] NOT NULL DEFAULT '{}',
        "status" character varying(24) NOT NULL DEFAULT 'active',
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resource_registry_id" PRIMARY KEY ("resource_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_resource_registry_org" ON "resource_registry" ("organization_id", "resource_type")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "principal_versions" (
        "user_id" integer NOT NULL,
        "token_version" integer NOT NULL DEFAULT 1,
        "permission_version" integer NOT NULL DEFAULT 1,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_principal_versions_user_id" PRIMARY KEY ("user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id" uuid NOT NULL,
        "aggregate_type" character varying(60) NOT NULL,
        "aggregate_id" character varying(120) NOT NULL,
        "event_type" character varying(120) NOT NULL,
        "payload" jsonb NOT NULL,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_outbox_events_unpublished" ON "outbox_events" ("published_at", "created_at")',
    );
  }
}
