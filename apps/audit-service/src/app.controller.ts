import { Controller, Get } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { ClickHouseService } from './clickhouse/clickhouse.service';

@Controller()
export class AppController {
  constructor(
    private readonly auditService: AuditService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  @Get('health')
  health() {
    return {
      service: 'audit-service',
      status: 'healthy',
      checks: {
        clickhouse: this.clickhouse.enabled,
      },
    };
  }

  @Get('audit')
  async list() {
    return this.auditService.listRecent();
  }
}
