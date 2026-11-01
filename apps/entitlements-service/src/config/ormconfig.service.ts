import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { setTypeormConfig } from './ormconfig';

@Injectable()
export class TypeORMConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return setTypeormConfig(this.configService) as TypeOrmModuleOptions;
  }
}
