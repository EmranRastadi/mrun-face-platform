import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ConsulService {
  private readonly logger = new Logger(ConsulService.name);

  constructor(
      private readonly http: HttpService,
      private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return `http://${this.config.get<string>('CONSUL_HOST')}:${this.config.get<string>('CONSUL_PORT')}`;
  }

  private get serviceName(): string {
    return this.config.get<string>('SERVICE_NAME', 'api-gateway');
  }

  private get servicePort(): number {
    return Number(this.config.get<string>('PORT', '80'));
  }

  private get podIp(): string {
    return this.config.get<string>('POD_IP', '127.0.0.1');
  }

  async get(key: string): Promise<string | undefined> {
    try {
      const { data } = await firstValueFrom(
          this.http.get(`${this.baseUrl}/v1/kv/${key}`),
      );

      if (!data?.length) {
        return undefined;
      }

      return Buffer.from(data[0].Value, 'base64').toString('utf8');
    } catch (error) {
      this.logger.error(`Failed to get key "${key}" from Consul`, error);
      return undefined;
    }
  }

  async put(key: string, value: string): Promise<void> {
    await firstValueFrom(
        this.http.put(`${this.baseUrl}/v1/kv/${key}`, value, {
          headers: {
            'Content-Type': 'text/plain',
          },
        }),
    );
  }

  async registerService(): Promise<void> {
    try {
      this.logger.log('***************************', {
        podIp: this.podIp,
        port: this.servicePort,
        type: typeof this.servicePort,
      });
      await firstValueFrom(
          this.http.put(`${this.baseUrl}/v1/agent/service/register`, {
            ID: this.serviceName,
            Name: this.serviceName,
            Address: this.podIp,
            Port: this.servicePort,
            Check: {
              HTTP: `http://${this.podIp}:${this.servicePort}/health`,
              Interval: '10s',
              Timeout: '5s',
            },
          }),
      );

      this.logger.log(
          `Registered service "${this.serviceName}" with Consul`,
      );
    } catch (error) {
      this.logger.error('Failed to register service with Consul', error);
      throw error;
    }
  }

  async deregisterService(): Promise<void> {
    try {
      await firstValueFrom(
          this.http.put(
              `${this.baseUrl}/v1/agent/service/deregister/${this.serviceName}`,
          ),
      );

      this.logger.log(
          `Deregistered service "${this.serviceName}" from Consul`,
      );
    } catch (error) {
      this.logger.error('Failed to deregister service from Consul', error);
    }
  }
}