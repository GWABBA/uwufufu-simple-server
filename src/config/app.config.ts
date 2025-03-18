import { registerAs } from '@nestjs/config';

export default registerAs(
  'app',
  (): Record<string, any> => ({
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 8080,
    jwtSecret: process.env.JWT_SECRET,
    serverUrl:
      process.env.NODE_ENV === 'production'
        ? process.env.PRODUCTION_SERVER_URL
        : process.env.DEVELOPMENT_SERVER_URL,
    frontUrl:
      process.env.NODE_ENV === 'production'
        ? process.env.PRODUCTION_FRONT_URL
        : process.env.DEVELOPMENT_FRONT_URL,
  }),
);
