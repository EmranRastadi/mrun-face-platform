import { Injectable } from '@nestjs/common';
import Consul from 'consul';

@Injectable()
export class ConsulService {
  private readonly consul: Consul;

  constructor() {
    this.consul = new Consul({
      host: process.env.CONSUL_HOST,
      port: Number(process.env.CONSUL_PORT),
      promisify: true,
    });
  }

  async get(key: string) {
    return this.consul.kv.get(key);
  }

  async set(key: string, value: string) {
    return this.consul.kv.set(key, value);
  }

  async list(prefix: string) {
    return this.consul.kv.keys(prefix);
  }

  getClient() {
    return this.consul;
  }
}