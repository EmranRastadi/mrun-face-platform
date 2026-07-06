// database.config.ts

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const DatabaseConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
  type: 'postgres',

  host: config.get<string>('DB_HOST'),
  port: config.get<number>('DB_PORT'),
  username: config.get<string>('DB_USERNAME'),
  password: config.get<string>('DB_PASSWORD'),
  database: config.get<string>('DB_NAME'),

  autoLoadEntities: true,
  synchronize: false,

  logging: true,
  logger: 'advanced-console',

  retryAttempts: 1,
  retryDelay: 1000,
}),
};
