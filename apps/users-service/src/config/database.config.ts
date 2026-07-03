import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const dbConfig = configService.get('database');
  
  return {
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.name,
    username: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl,
    synchronize: configService.get('nodeEnv') === 'development',
    autoLoadEntities: true,
    logging: configService.get('nodeEnv') === 'development',
  };
};