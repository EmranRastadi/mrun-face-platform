import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/health')
  health() {
    return { service: 'analytics-service', status: 'healthy' };
  }
}
