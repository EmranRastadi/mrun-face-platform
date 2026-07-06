import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  APP_NAME: Joi.string().default('api-gateway'),

  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().required(),

  DB_PORT: Joi.number().default(5432),

  DB_USERNAME: Joi.string().required(),

  DB_PASSWORD: Joi.string().required(),

  DB_NAME: Joi.string().required(),

  DB_SSL: Joi.boolean().default(false),
});