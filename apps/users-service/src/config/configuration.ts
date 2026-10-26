export default () => ({
  app: {
    name: process.env.APP_NAME || 'api-gateway',
    port: parseInt(process.env.PORT ?? '3000', 10),
    environment: process.env.NODE_ENV || 'development',
  },

  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtIssuer: process.env.JWT_ISSUER || 'mrun-users-service',
    jwtAudience: process.env.JWT_AUDIENCE || 'mrun-platform',
  },
});