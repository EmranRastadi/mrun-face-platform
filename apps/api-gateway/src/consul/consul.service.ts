import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ConsulService {
  private readonly serviceName =
      process.env.APP_NAME ?? 'unknown';

  private readonly servicePort =
      Number(process.env.APP_PORT ?? 3000);

  private readonly podIp =
      process.env.POD_IP ?? '127.0.0.1';
  private readonly baseUrl = `http://${process.env.CONSUL_HOST}:${process.env.CONSUL_PORT}`;

  constructor(private readonly http: HttpService) {}

  async get(key: string): Promise<string | undefined> {
    try {
      const { data } = await firstValueFrom(
          this.http.get(`${this.baseUrl}/v1/kv/${key}`),
      );

      if (!data.length) {
        return undefined;
      }

      return Buffer.from(data[0].Value, 'base64').toString('utf8');
    } catch {
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

  }

  async deregisterService(): Promise<void> {

  }
}