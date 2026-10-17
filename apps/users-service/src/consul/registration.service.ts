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

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.warn('Consul registration disabled (CONSUL_ENABLED != true)');
      return;
    }
    // Register in the background with retries so a transient Consul outage at
    // startup does not leave the service permanently unregistered.
    void this.registerWithRetry();
  }

  private async registerWithRetry(maxAttempts = 12): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.consul.registerService();
        return;
      } catch (error) {
        this.logger.error(
          `Consul registration failed (attempt ${attempt}/${maxAttempts})`,
          error instanceof Error ? error.stack : String(error),
        );
        if (attempt < maxAttempts) {
          await new Promise((r) =>
            setTimeout(r, Math.min(attempt * 2000, 15000)),
          );
        }
      }
    }
    this.logger.error(
      `Consul registration gave up after ${maxAttempts} attempts`,
    );
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
