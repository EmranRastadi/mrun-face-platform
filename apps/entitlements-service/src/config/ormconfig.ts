import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

const asBoolean = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

/**
 * Single source of truth for the TypeORM configuration. `synchronize` is only
 * enabled for local development (or explicitly through `DB_SYNCHRONIZE`); in
 * production the schema is owned by the migrations in `common/database`.
 */
export const setTypeormConfig = (
  conf: NodeJS.ProcessEnv | ConfigService,
): DataSourceOptions => {
  const getConfigValue = (key: string): string | undefined =>
    conf instanceof ConfigService ? conf.get<string>(key) : conf[key];

  const nodeEnv = getConfigValue('NODE_ENV') ?? 'development';
  const isTest = nodeEnv === 'test';

  return {
    type: 'postgres',
    host: getConfigValue('DB_HOST') ?? 'localhost',
    port: parseInt(getConfigValue('DB_PORT') ?? '5432', 10),
    username: getConfigValue('DB_USER') ?? 'entitlements',
    password: getConfigValue('DB_PASSWORD') ?? 'entitlements',
    database: getConfigValue('DB_NAME') ?? 'entitlements',
    ssl: asBoolean(getConfigValue('DB_SSL')),
    entities: [
      isTest
        ? 'src/**/*.entity.{ts,js}'
        : 'dist/**/*.entity.js',
    ],
    migrations: [
      isTest
        ? 'src/common/database/migrations/*.{ts,js}'
        : 'dist/common/database/migrations/*.js',
    ],
    migrationsTableName: 'schema_migrations',
    synchronize:
      getConfigValue('DB_SYNCHRONIZE') !== undefined
        ? asBoolean(getConfigValue('DB_SYNCHRONIZE'))
        : nodeEnv !== 'production',
    dropSchema: isTest && asBoolean(getConfigValue('DB_DROP_SCHEMA')),
    migrationsRun: asBoolean(getConfigValue('DB_MIGRATIONS_RUN')),
    logging: asBoolean(getConfigValue('DB_LOGGING')),
  };
};

export default new DataSource(setTypeormConfig(process.env));
