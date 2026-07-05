import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RegistrationService } from './registration.service';
import { ConsulService } from './consul.service';
import { AppConfigService } from './config.service';

@Module({
    imports: [HttpModule],

    providers: [
        ConsulService,
        AppConfigService,
        RegistrationService
    ],

    exports: [
        ConsulService,
        AppConfigService,
    ],
})
export class PlatformConfigModule {}