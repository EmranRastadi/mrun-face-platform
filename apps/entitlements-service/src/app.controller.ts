import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './auth/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  @Get('health')
  @Public()
  health() {
    return {
      status: 'ok',
      service: 'entitlements-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('info')
  @Public()
  info() {
    return {
      service: 'entitlements-service',
      description: 'Plans, subscriptions and entitlement resolution',
      version: '1.0.0',
    };
  }
}
