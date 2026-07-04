import {forwardRef, Module} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { getDatabaseConfig } from './config/database.config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
@Module({
  imports: [
    // ✅ بارگذاری Config با پشتیبانی از .env
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: [
        '.env.local',    // محلی (اولویت بالاتر)
        '.env',          // پیش‌فرض
      ],
      expandVariables: true, // ✅ پشتیبانی از ${VAR} در env
    }),
    forwardRef(() => ConsulModule),
    // ✅ استفاده از Config برای Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    
    // سایر ماژول‌ها...
  ],
  providers: [
        {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor, // ✅ اینجا ConfigService تزریق می‌شود
    },
  ]
})
export class AppModule {}