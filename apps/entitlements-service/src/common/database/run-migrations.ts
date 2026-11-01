import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { setTypeormConfig } from '../../config/ormconfig';

/**
 * Standalone migration runner:
 *   node dist/common/database/run-migrations.js
 *
 * Used by a Kubernetes Job or a manual rollout. The service itself only runs
 * migrations in-process when `DB_MIGRATIONS_RUN=true`.
 */
async function main(): Promise<void> {
  const dataSource = new DataSource(setTypeormConfig(process.env));

  try {
    await dataSource.initialize();
    const applied = await dataSource.runMigrations();
    if (!applied.length) {
      console.log('No pending migrations.');
    }
    for (const migration of applied) {
      console.log(`Applied ${migration.name}`);
    }
  } catch (error) {
    console.error(
      `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main();
