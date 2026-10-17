import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('health')
  health() {
    return this.analytics.health();
  }

  @Get('recognitions')
  recognitions(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.recognitionStats(from, to);
  }

  @Get('cameras')
  cameras() {
    return this.analytics.cameraStats();
  }

  @Get('latency')
  latency() {
    return this.analytics.latencyStats();
  }

  @Get('activity')
  activity(@Query('limit') limit?: string) {
    return this.analytics.recentActivity(limit ? Number(limit) : 50);
  }
}
