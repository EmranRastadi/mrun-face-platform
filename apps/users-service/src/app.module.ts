import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConsulModule } from './consul/consul.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('environment') === 'development',
        logging: configService.get('environment') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Modules
    UsersModule,
    ConsulModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}