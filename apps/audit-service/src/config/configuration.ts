export default () => ({
  port: parseInt(process.env.PORT ?? '3003', 10),
  environment: process.env.ENVIRONMENT ?? 'development',
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'audit-service',
    groupId: process.env.KAFKA_GROUP_ID ?? 'audit-workers',
    enabled: process.env.KAFKA_ENABLED === 'true',
  },
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST ?? 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT ?? '8123', 10),
    user: process.env.CLICKHOUSE_USER ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD ?? '',
    database: process.env.CLICKHOUSE_DATABASE ?? 'mrun',
    enabled: process.env.CLICKHOUSE_ENABLED === 'true',
  },
});
