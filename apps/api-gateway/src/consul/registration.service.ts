import {
    Injectable,
    OnApplicationBootstrap,
    OnApplicationShutdown,
} from '@nestjs/common';
import { ConsulService } from './consul.service';

@Injectable()
export class RegistrationService
    implements OnApplicationBootstrap, OnApplicationShutdown
{
    constructor(private readonly consul: ConsulService) {}

    async onApplicationBootstrap(): Promise<void> {
        await this.consul.registerService();
    }

    async onApplicationShutdown(): Promise<void> {
        await this.consul.deregisterService();
    }
}