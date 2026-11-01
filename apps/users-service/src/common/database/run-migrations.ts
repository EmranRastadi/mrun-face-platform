import 'reflect-metadata';
import { setTypeormConfig } from '../../config/ormconfig';
import { DataSource } from 'typeorm';

/**
 * Standalone migration runner so the schema can be advanced before a rollout
 * (Kubernetes Job / `make migrate`) without enabling `migrationsRun` in the
 * application process.
 *
 * Usage: `node dist/common/database/run-migrations.js`
 */
async function main(): Promise<void> {
  const dataSource = new DataSource(setTypeormConfig(process.env));
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations();
    if (!applied.length) {
      console.log('No pending migrations.');
      return;
    }
    for (const migration of applied) {
      console.log(`Applied ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
