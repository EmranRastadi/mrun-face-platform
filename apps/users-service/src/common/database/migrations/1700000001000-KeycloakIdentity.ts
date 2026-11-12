import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links a local platform user to a Keycloak identity by its stable `sub`
 * claim. Usernames and e-mail addresses are mutable in Keycloak, so they are
 * only used to bootstrap the link for existing accounts.
 *
 * The unique index is partial because local accounts that never authenticate
 * through Keycloak keep a NULL value. PostgreSQL allows multiple NULLs in a
 * unique index, but making the intent explicit keeps the constraint portable.
 */
export class KeycloakIdentity1700000001000 implements MigrationInterface {
  name = 'KeycloakIdentity1700000001000';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "uq_users_keycloak_sub"');
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "keycloak_sub"',
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "keycloak_sub" character varying(64)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_keycloak_sub"
      ON "users" ("keycloak_sub")
      WHERE "keycloak_sub" IS NOT NULL
    `);
  }
}
