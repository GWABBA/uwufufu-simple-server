import { registerAs } from '@nestjs/config';

export default registerAs(
  'redis',
  (): Record<string, any> => ({
    host: process.env.CACHE_HOST,
    port: process.env.CACHE_PORT,
    tls: process.env.CACHE_TLS,
    isCluster: process.env.CACHE_IS_CLUSTER,
  }),
);
