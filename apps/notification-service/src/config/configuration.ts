export default () => ({
  port: parseInt(process.env.PORT ?? '3004', 10),
  environment: process.env.ENVIRONMENT ?? 'development',
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'notification-service',
    groupId: process.env.KAFKA_GROUP_ID ?? 'notification-workers',
    enabled: process.env.KAFKA_ENABLED === 'true',
  },
  dragonfly: {
    host: process.env.DRAGONFLY_HOST ?? 'localhost',
    port: parseInt(process.env.DRAGONFLY_PORT ?? '6379', 10),
    enabled: process.env.DRAGONFLY_ENABLED === 'true',
  },
  notify: {
    rateLimitPerMinute: parseInt(
      process.env.NOTIFY_RATE_LIMIT_PER_MINUTE ?? '30',
      10,
    ),
    dedupeTtlSeconds: parseInt(
      process.env.NOTIFY_DEDUPE_TTL_SECONDS ?? '300',
      10,
    ),
  },
});
