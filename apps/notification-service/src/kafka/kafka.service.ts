import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, Producer } from 'kafkajs';

export type MessageHandler = (event: Record<string, unknown>) => Promise<void>;

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private consumer?: Consumer;
  private producer?: Producer;
  private readonly handlers: Array<{ topic: string; handler: MessageHandler }> =
    [];
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('kafka.enabled', false);
  }

  register(topic: string, handler: MessageHandler): void {
    this.handlers.push({ topic, handler });
  }

  async publish(topic: string, event: Record<string, unknown>): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`[no-op publish] ${topic} ${JSON.stringify(event)}`);
      return;
    }
    if (!this.producer) {
      const kafka = new Kafka({
        clientId: this.config.get<string>(
          'kafka.clientId',
          'notification-service',
        ),
        brokers: this.config.get<string[]>('kafka.brokers', ['localhost:9092']),
      });
      this.producer = kafka.producer();
      await this.producer.connect();
    }
    await this.producer.send({
      topic,
      messages: [
        {
          key: String(event.aggregateId ?? ''),
          value: JSON.stringify(event),
        },
      ],
    });
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Kafka disabled — consumer not started');
      return;
    }
    const kafka = new Kafka({
      clientId: this.config.get<string>(
        'kafka.clientId',
        'notification-service',
      ),
      brokers: this.config.get<string[]>('kafka.brokers', ['localhost:9092']),
    });
    this.consumer = kafka.consumer({
      groupId: this.config.get<string>('kafka.groupId', 'notification-workers'),
    });
    await this.consumer.connect();

    const topics = [...new Set(this.handlers.map((h) => h.topic))];
    if (topics.length) {
      await this.consumer.subscribe({ topics, fromBeginning: false });
    }

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(message.value?.toString() ?? '{}');
        } catch (err) {
          this.logger.error(
            `Invalid JSON on ${topic}: ${(err as Error).message}`,
          );
          return;
        }
        for (const h of this.handlers.filter((x) => x.topic === topic)) {
          try {
            await h.handler(event);
          } catch (err) {
            this.logger.error(
              `Handler failed for ${topic}: ${(err as Error).message}`,
            );
          }
        }
      },
    });
    this.logger.log(`Kafka consumer started for topics: ${topics.join(', ')}`);
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
