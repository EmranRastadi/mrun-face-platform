import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Dragonfly (Redis-compatible) client for rate limiting + dedupe.
 * Falls back to an in-memory counter when disabled.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;
  private readonly mem = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('dragonfly.enabled', false);
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Dragonfly disabled — using in-memory limiter');
      return;
    }
    this.client = new Redis({
      host: this.config.get<string>('dragonfly.host', 'localhost'),
      port: this.config.get<number>('dragonfly.port', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    this.client.connect().catch((err) => {
      this.logger.error(`Dragonfly connect failed: ${err.message}`);
    });
  }

  /** Returns true when the action is allowed (under the limit). */
  async allow(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    if (!this.client) {
      const now = Date.now();
      const entry = this.mem.get(key);
      if (!entry || entry.expiresAt < now) {
        this.mem.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    }
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return current <= limit;
  }

  /** Returns true if the key was seen for the first time (not a duplicate). */
  async firstSeen(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      const now = Date.now();
      const entry = this.mem.get(key);
      if (entry && entry.expiresAt > now) return false;
      this.mem.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
      return true;
    }
    const set = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return set === 'OK';
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }
}
