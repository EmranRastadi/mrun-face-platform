import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Read-only ClickHouse client over the HTTP interface (port 8123).
 */
@Injectable()
export class ClickHouseService implements OnModuleInit {
  private readonly logger = new Logger(ClickHouseService.name);
  private readonly url: string;
  private readonly auth: string;
  readonly enabled: boolean;
  private readonly database: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('clickhouse.host', 'localhost');
    const port = this.config.get<number>('clickhouse.port', 8123);
    const user = this.config.get<string>('clickhouse.user', 'default');
    const password = this.config.get<string>('clickhouse.password', '');
    this.database = this.config.get<string>('clickhouse.database', 'mrun');
    this.enabled = this.config.get<boolean>('clickhouse.enabled', false);
    this.url = `http://${host}:${port}/`;
    this.auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('ClickHouse disabled — analytics returns empty results');
    }
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!this.enabled) return [];
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: this.auth },
      body: `${sql} FORMAT JSON`,
    });
    if (!res.ok) {
      throw new Error(
        `ClickHouse query failed: ${res.status} ${res.statusText}`,
      );
    }
    const json = (await res.json()) as { data?: T[] };
    return json.data ?? [];
  }

  get db(): string {
    return this.database;
  }
}
