import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common';

import { ConsulService } from './consul.service';

@Injectable()
export class RegistrationService
    implements OnModuleInit, OnModuleDestroy
{
    constructor(private readonly consul: ConsulService) {}

    async onModuleInit() {
        await this.consul.register();
    }

    async onModuleDestroy() {
        await this.consul.deregister();
    }
}