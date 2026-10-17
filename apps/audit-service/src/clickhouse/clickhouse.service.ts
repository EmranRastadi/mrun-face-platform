import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin ClickHouse client over the HTTP interface (port 8123).
 * Disabled by default so the service boots without ClickHouse present.
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

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('ClickHouse disabled — running in no-op mode');
      return;
    }
    try {
      await this.command(`CREATE DATABASE IF NOT EXISTS ${this.database}`);
      await this.command(`
        CREATE TABLE IF NOT EXISTS ${this.database}.audit_events (
          event_id      String,
          event_name    String,
          actor         String,
          action        String,
          resource_type String,
          resource_id   String,
          outcome       String,
          ip            String,
          occurred_on   DateTime64(3)
        ) ENGINE = MergeTree()
        ORDER BY (occurred_on, resource_type, resource_id)
      `);
      this.logger.log('ClickHouse schema ready');
    } catch (err) {
      this.logger.error(`ClickHouse init failed: ${(err as Error).message}`);
    }
  }

  async command(sql: string): Promise<void> {
    if (!this.enabled) return;
    await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: this.auth },
      body: `${sql} FORMAT JSON`,
    });
  }

  async insert(table: string, row: Record<string, unknown>): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`[no-op insert] ${table} ${JSON.stringify(row)}`);
      return;
    }
    const columns = Object.keys(row).join(', ');
    const values = Object.values(row)
      .map((v) => {
        if (typeof v === 'number') return v;
        return `'${String(v).replace(/'/g, "\\'")}'`;
      })
      .join(', ');
    await this.command(
      `INSERT INTO ${this.database}.${table} (${columns}) VALUES (${values})`,
    );
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!this.enabled) return [];
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: this.auth },
      body: `${sql} FORMAT JSON`,
    });
    const json = (await res.json()) as { data?: T[] };
    return json.data ?? [];
  }
}
