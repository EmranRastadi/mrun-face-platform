export default () => ({
  service: {
    name: process.env.SERVICE_NAME || 'user-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.ENVIRONMENT || 'development',
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 8000,
  },
  consul: {
    host: process.env.CONSUL_HOST || 'localhost',
    port: parseInt(process.env.CONSUL_PORT, 10) || 8500,
    enabled: process.env.CONSUL_ENABLED !== 'false',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'mrun',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
});