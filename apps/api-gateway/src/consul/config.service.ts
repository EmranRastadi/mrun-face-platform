import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConsulService } from './consul.service';

@Injectable()
export class AppConfigService implements OnModuleInit {
    constructor(private readonly consul: ConsulService) {}

    public kafkaBroker!: string;
    public keycloakUrl!: string;

    async onModuleInit(): Promise<void> {
        this.kafkaBroker =
            (await this.consul.get('mrun/kafka/brokers')) ?? '';

        this.keycloakUrl =
            (await this.consul.get('mrun/keycloak/url')) ?? '';
    }
}