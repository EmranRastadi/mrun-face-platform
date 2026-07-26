import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';

@Injectable()
export class KafkaService implements OnModuleInit {
  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  async emit(topic: string, payload: unknown): Promise<void> {
    return firstValueFrom(this.kafka.emit(topic, payload));
  }

  async onModuleInit() {
    try {
      await this.kafka.connect();
      console.log('✅ Connected to Kafka');
    } catch (err) {
      console.error('❌ Kafka connection failed', err);
    }
  }
}