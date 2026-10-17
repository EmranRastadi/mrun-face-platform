import { Controller, Get } from '@nestjs/common';
import { NotificationService } from './notification/notification.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  health() {
    return {
      service: 'notification-service',
      status: 'healthy',
      checks: { dragonfly: this.redis.enabled },
    };
  }

  @Get('notifications')
  list() {
    return this.notifications.listRecent();
  }
}
