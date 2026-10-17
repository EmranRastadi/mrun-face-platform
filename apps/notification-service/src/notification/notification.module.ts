import { Module } from '@nestjs/common';
import { ChannelDispatcher } from './channels';
import { NotificationService } from './notification.service';

@Module({
  providers: [NotificationService, ChannelDispatcher],
  exports: [NotificationService],
})
export class NotificationModule {}
