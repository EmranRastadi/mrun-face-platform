import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@mrun/events';

export interface DeliveryResult {
  channel: NotificationChannel;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * Channel dispatcher. Providers are stubs until the real gateway
 * (Twilio/FCM/SES/etc.) endpoints are configured.
 */
@Injectable()
export class ChannelDispatcher {
  private readonly logger = new Logger(ChannelDispatcher.name);

  async send(
    channel: NotificationChannel,
    template: string,
    data: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    try {
      switch (channel) {
        case 'sms':
        case 'push':
        case 'email':
          this.logger.log(
            `[${channel}] template=${template} data=${JSON.stringify(data)}`,
          );
          return { channel, status: 'sent' };
        default:
          return { channel, status: 'failed', error: 'unknown channel' };
      }
    } catch (err) {
      return { channel, status: 'failed', error: (err as Error).message };
    }
  }
}
