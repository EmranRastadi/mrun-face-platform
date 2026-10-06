import { Injectable } from '@nestjs/common';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly clickhouse: ClickHouseService) {}

  async health() {
    return { clickhouse: this.clickhouse.enabled };
  }

  async recognitionStats(from?: string, to?: string) {
    const range = this.timeRange(from, to);
    return this.clickhouse.query(`
      SELECT
        toDate(occurred_on) AS day,
        count() AS total,
        countIf(outcome = 'success') AS matched,
        countIf(outcome = 'failure') AS missed
      FROM ${this.clickhouse.db}.audit_events
      WHERE action = 'recognition' ${range}
      GROUP BY day
      ORDER BY day DESC
      LIMIT 90
    `);
  }

  async cameraStats() {
    return this.clickhouse.query(`
      SELECT
        resource_id AS camera_id,
        count() AS recognitions,
        countIf(outcome = 'success') AS matched
      FROM ${this.clickhouse.db}.audit_events
      WHERE action = 'recognition'
      GROUP BY camera_id
      ORDER BY recognitions DESC
      LIMIT 50
    `);
  }

  async latencyStats() {
    return this.clickhouse.query(`
      SELECT
        toStartOfHour(occurred_on) AS hour,
        count() AS events
      FROM ${this.clickhouse.db}.audit_events
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 168
    `);
  }

  async recentActivity(limit = 50) {
    return this.clickhouse.query(`
      SELECT event_name, actor, action, resource_type, resource_id, outcome, occurred_on
      FROM ${this.clickhouse.db}.audit_events
      ORDER BY occurred_on DESC
      LIMIT ${Number(limit) || 50}
    `);
  }

  private timeRange(from?: string, to?: string): string {
    const parts: string[] = [];
    if (from) parts.push(`AND occurred_on >= '${this.sanitize(from)}'`);
    if (to) parts.push(`AND occurred_on <= '${this.sanitize(to)}'`);
    return parts.join(' ');
  }

  private sanitize(value: string): string {
    return value.replace(/'/g, '');
  }
}
