import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { cwd, env } from 'process';
import { DataSource, DataSourceOptions } from 'typeorm';


export const setTypeormConfig = (
    conf: NodeJS.ProcessEnv | ConfigService,
): DataSourceOptions => {
    const getConfigValue =
        conf instanceof ConfigService
            ? conf.get.bind(conf)
            : (key: string) => conf[key];
    return {
        type: 'postgres',
        host: getConfigValue('DB_HOST') || 'localhost',
        port: Number(getConfigValue('DB_PORT')) || 5432,
        username: getConfigValue('DB_USER') || 'users',
        password: getConfigValue('DB_PASSWORD') || '123456',
        database: getConfigValue('DB_NAME') || 'users',
        entities:
            getConfigValue('NODE_ENV') === 'test'
                ? [join(cwd(), 'src', '**', '*.entity.{ts,js}')]
                : [join(cwd(), 'dist', '**', '*.entity.js')],
        // synchronize: getConfigValue('NODE_ENV') !== 'production',
        synchronize: true,
        dropSchema: getConfigValue('NODE_ENV') === 'test',
        migrations: [
            join(cwd(), 'dist', 'common', 'database', 'migrations', '*{.ts,.js}'),
        ],
        migrationsRun: false,
        logging: false,
    };
};

export default new DataSource(setTypeormConfig(env));