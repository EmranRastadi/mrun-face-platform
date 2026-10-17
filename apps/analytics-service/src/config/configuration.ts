export default () => ({
  port: parseInt(process.env.PORT ?? '3005', 10),
  environment: process.env.ENVIRONMENT ?? 'development',
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST ?? 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT ?? '8123', 10),
    user: process.env.CLICKHOUSE_USER ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD ?? '',
    database: process.env.CLICKHOUSE_DATABASE ?? 'mrun',
    enabled: process.env.CLICKHOUSE_ENABLED === 'true',
  },
});
