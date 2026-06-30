import { Injectable, OnApplicationShutdown, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as consul from 'consul';

@Injectable()
export class ConsulService implements OnApplicationShutdown {
  private readonly logger = new Logger(ConsulService.name);
  private client: consul.Consul;
  private serviceId: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get('consul.host');
    const port = this.configService.get('consul.port');
    const enabled = this.configService.get('consul.enabled');

    if (enabled) {
      this.client = new consul.Consul({
        host,
        port,
        promisify: true,
      });
      this.logger.log(`✅ Connected to Consul at ${host}:${port}`);
    }
  }

  async registerService(): Promise<void> {
    const enabled = this.configService.get('consul.enabled');
    if (!enabled || !this.client) {
      this.logger.warn('⚠️ Consul is disabled');
      return;
    }

    const serviceName = this.configService.get('service.name');
    const servicePort = this.configService.get('server.port');
    const serviceVersion = this.configService.get('service.version');

    this.serviceId = `${serviceName}-${servicePort}`;

    try {
      await this.client.agent.service.register({
        name: serviceName,
        id: this.serviceId,
        address: 'mrun-users', // نام سرویس در Docker
        port: servicePort,
        tags: ['nestjs', 'users', `v${serviceVersion}`],
        check: {
          http: `http://mrun-users:${servicePort}/health`,
          interval: '10s',
          timeout: '5s',
          deregister_after: '30s',
        },
      });
      this.logger.log(`✅ Service '${serviceName}' registered in Consul`);
    } catch (error) {
      this.logger.error(`❌ Failed to register service: ${error.message}`);
    }
  }

  async getService(name: string): Promise<any> {
    if (!this.client) return null;

    try {
      const services = await this.client.agent.services();
      for (const [id, service] of Object.entries(services)) {
        if (service.Service === name) {
          return service;
        }
      }
      return null;
    } catch (error) {
      this.logger.error(`❌ Failed to get service: ${error.message}`);
      return null;
    }
  }

  async getAllServices(): Promise<any> {
    if (!this.client) return {};

    try {
      return await this.client.agent.services();
    } catch (error) {
      this.logger.error(`❌ Failed to get services: ${error.message}`);
      return {};
    }
  }

  async onApplicationShutdown(signal?: string) {
    if (!this.client || !this.serviceId) return;

    try {
      await this.client.agent.service.deregister(this.serviceId);
      this.logger.log(`✅ Service '${this.serviceId}' deregistered from Consul`);
    } catch (error) {
      this.logger.error(`❌ Failed to deregister service: ${error.message}`);
    }
  }
}