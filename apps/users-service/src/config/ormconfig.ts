import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { cwd, env } from 'process';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Schema management policy:
 * - `DB_SYNCHRONIZE=true` opt-in for local development only.
 * - production and any shared environment must rely on migrations
 *   (`DB_MIGRATIONS_RUN=true`) or an explicit `make migrate` step.
 * - `DB_DROP_SCHEMA=true` is test-only and destroys all data.
 */
const asBoolean = (
    value: string | undefined,
    fallback: boolean,
): boolean => {
    if (value === undefined || value === '') return fallback;
    return value === 'true' || value === '1';
};

export const setTypeormConfig = (
    conf: NodeJS.ProcessEnv | ConfigService,
): DataSourceOptions => {
    const getConfigValue =
        conf instanceof ConfigService
            ? conf.get.bind(conf)
            : (key: string) => conf[key];

    const nodeEnv = getConfigValue('NODE_ENV') ?? 'development';
    const isTest = nodeEnv === 'test';

    return {
        type: 'postgres',
        host: getConfigValue('DB_HOST') || 'localhost',
        port: Number(getConfigValue('DB_PORT')) || 5432,
        username: getConfigValue('DB_USER') || 'users',
        password: getConfigValue('DB_PASSWORD') || '123456',
        database: getConfigValue('DB_NAME') || 'users',
        entities: isTest
            ? [join(cwd(), 'src', '**', '*.entity.{ts,js}')]
            : [join(cwd(), 'dist', '**', '*.entity.js')],
        migrations: isTest
            ? [join(cwd(), 'src', 'common', 'database', 'migrations', '*.{ts,js}')]
            : [join(cwd(), 'dist', 'common', 'database', 'migrations', '*.js')],
        synchronize: asBoolean(getConfigValue('DB_SYNCHRONIZE'), nodeEnv !== 'production'),
        dropSchema: isTest && asBoolean(getConfigValue('DB_DROP_SCHEMA'), false),
        migrationsRun: asBoolean(getConfigValue('DB_MIGRATIONS_RUN'), false),
        migrationsTableName: 'schema_migrations',
        logging: asBoolean(getConfigValue('DB_LOGGING'), false),
    };
};

export default new DataSource(setTypeormConfig(env));
