import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationChannel,
  NotificationEventNames,
  NotificationRequestedEvent,
} from '@mrun/events';
import { KafkaService } from '../kafka/kafka.service';
import { RedisService } from '../redis/redis.service';
import { ChannelDispatcher } from './channels';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private readonly recent: Record<string, unknown>[] = [];

  constructor(
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly dispatcher: ChannelDispatcher,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.kafka.register('notification.events', (event) =>
      this.handleRequested(event as unknown as NotificationRequestedEvent),
    );
    this.kafka.register('recognition.events', (event) =>
      this.handleRecognition(event),
    );
  }

  private async handleRequested(event: NotificationRequestedEvent) {
    const payload = event.payload;
    if (!payload) return;
    await this.deliver(
      payload.channel,
      payload.template,
      payload.data,
      payload.userId ?? payload.personId ?? 'unknown',
    );
  }

  private async handleRecognition(event: Record<string, unknown>) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    if (!payload.matched) return;
    await this.deliver('push', 'recognition.matched', payload, 'system');
  }

  private async deliver(
    channel: NotificationChannel,
    template: string,
    data: Record<string, unknown>,
    subject: string,
  ) {
    const rateLimit = this.config.get<number>('notify.rateLimitPerMinute', 30);
    const dedupeTtl = this.config.get<number>('notify.dedupeTtlSeconds', 300);

    const dedupeKey = `notify:dedupe:${channel}:${subject}:${template}`;
    if (!(await this.redis.firstSeen(dedupeKey, dedupeTtl))) {
      this.logger.debug(`duplicate suppressed: ${dedupeKey}`);
      return;
    }

    const rateKey = `notify:rate:${subject}`;
    if (!(await this.redis.allow(rateKey, rateLimit, 60))) {
      this.logger.warn(`rate limit hit for ${subject}`);
      return;
    }

    const result = await this.dispatcher.send(channel, template, data);
    const record = {
      notificationId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      channel,
      template,
      subject,
      status: result.status,
      error: result.error ?? null,
      deliveredAt: new Date().toISOString(),
    };
    this.recent.unshift(record);
    this.recent.splice(100);

    await this.kafka.publish('notification.events', {
      eventId: record.notificationId,
      eventName: NotificationEventNames.NOTIFICATION_DELIVERED,
      occurredOn: record.deliveredAt,
      aggregateId: subject,
      version: 1,
      payload: {
        notificationId: record.notificationId,
        channel,
        status: result.status,
        error: result.error,
      },
    });
    this.logger.log(`delivered ${template} via ${channel} → ${result.status}`);
  }

  listRecent() {
    return { count: this.recent.length, data: this.recent };
  }
}
