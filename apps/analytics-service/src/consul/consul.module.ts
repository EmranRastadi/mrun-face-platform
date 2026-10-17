import {
  Global,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ConsulInstance {
  ID: string;
  Service: string;
  Address: string;
  Port: number;
}

@Injectable()
export class ConsulService {
  private readonly logger = new Logger(ConsulService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return `http://${this.config.get<string>('CONSUL_HOST', 'localhost')}:${this.config.get<string>('CONSUL_PORT', '8500')}`;
  }

  private get serviceName(): string {
    return (
      this.config.get<string>('SERVICE_NAME') ??
      this.config.get<string>('HOSTNAME', 'unknown-service')
    );
  }

  private get servicePort(): number {
    return Number(this.config.get<string>('PORT', '3000'));
  }

  private get address(): string {
    return (
      this.config.get<string>('POD_IP') ??
      this.config.get<string>('HOSTNAME', '127.0.0.1')
    );
  }

  // Unique per instance so a terminating pod's deregistration cannot remove a
  // sibling/newer pod that shares the same service name.
  private get serviceId(): string {
    return `${this.serviceName}-${this.address}`;
  }

  async registerService(): Promise<void> {
    const body = {
      ID: this.serviceId,
      Name: this.serviceName,
      Address: this.address,
      Port: this.servicePort,
      Check: {
        HTTP: `http://${this.address}:${this.servicePort}/health`,
        Interval: '10s',
        Timeout: '5s',
        // Auto-remove this instance if its health check stays critical
        // (e.g. the pod was killed without a graceful shutdown, leaving a
        // stale registration whose IP no longer routes).
        DeregisterCriticalServiceAfter: '5m',
      },
    };

    const response = await fetch(`${this.baseUrl}/v1/agent/service/register`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Consul register failed with status ${response.status}`);
    }

    this.logger.log(
      `Registered "${this.serviceName}" (${this.address}:${this.servicePort}) with Consul`,
    );
  }

  async deregisterService(): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/agent/service/deregister/${this.serviceId}`,
        { method: 'PUT' },
      );

      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }

      this.logger.log(`Deregistered "${this.serviceName}" from Consul`);
    } catch (error) {
      this.logger.error(
        'Failed to deregister service from Consul',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async resolve(serviceName: string): Promise<ConsulInstance | undefined> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/health/service/${serviceName}?passing=true`,
      );

      if (!response.ok) {
        return undefined;
      }

      const instances = (await response.json()) as Array<{
        Service: ConsulInstance;
      }>;

      return instances.length ? instances[0].Service : undefined;
    } catch (error) {
      this.logger.error(
        `Failed to resolve "${serviceName}" from Consul`,
        error instanceof Error ? error.stack : String(error),
      );
      return undefined;
    }
  }
}

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

@Global()
@Module({
  providers: [ConsulService, RegistrationService],
  exports: [ConsulService],
})
export class ConsulModule {}
