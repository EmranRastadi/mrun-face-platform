import { Injectable } from '@nestjs/common';
import Consul from 'consul';


@Injectable()
export class ConsulService {
  private readonly serviceName =
      process.env.APP_NAME!;

  private readonly servicePort =
      Number(process.env.APP_PORT);

  private readonly serviceAddress =
      process.env.POD_IP!;
  private readonly consul: Consul;

  constructor() {
    this.consul = new Consul({
      host: process.env.CONSUL_HOST,
      port: Number(process.env.CONSUL_PORT),
    });
  }

  async get(key: string): Promise<string | undefined> {
    const item = await this.consul.kv.get(key);

    if (!item || item.Value == null) {
      return undefined;
    }

    return Buffer.from(item.Value, 'base64').toString('utf8');
  }

  async register() {
    await this.consul.agent.service.register({
      id: `${this.serviceName}-${this.serviceAddress}`,
      name: this.serviceName,
      address: this.serviceAddress,
      port: this.servicePort,

      check: {
        name: `${this.serviceName}-health`,
        http: `http://${this.serviceAddress}:${this.servicePort}/health`,
        interval: '10s',
        timeout: '5s',
      },
    });
  }

  async deregister() {
    await this.consul.agent.service.deregister(
        `${this.serviceName}-${this.serviceAddress}`,
    );
  }
}