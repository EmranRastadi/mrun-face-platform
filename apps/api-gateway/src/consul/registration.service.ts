import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsulService } from './consul.service';

@Injectable()
export class RegistrationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly consul: ConsulService,
    private readonly config: ConfigService,
  ) {}

  private get enabled(): boolean {
    return this.config.get<string>('CONSUL_ENABLED', 'false') === 'true';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('Consul registration disabled (CONSUL_ENABLED != true)');
      return;
    }
    try {
      await this.consul.registerService();
    } catch (error) {
      this.logger.error(
        'Consul registration failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    try {
      await this.consul.deregisterService();
    } catch (error) {
      this.logger.error(
        'Consul deregistration failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
