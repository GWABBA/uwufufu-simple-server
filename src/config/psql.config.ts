import { registerAs } from '@nestjs/config';

export default registerAs(
  'psql',
  (): Record<string, any> => ({
    host: process.env.PSQL_DATABASE_HOST,
    port: parseInt(process.env.PSQL_DATABASE_PORT, 10) || 5432,
    databaseName: process.env.PSQL_DATABASE_NAME,
    userName: process.env.PSQL_DATABASE_USER,
    password: process.env.PSQL_DATABASE_PASSWORD,
    sync: process.env.PSQL_DATABASE_SYNC === 'true',
    sslCertPath: process.env.PSQL_SSL_CERT_PATH,
    ssl: process.env.PSQL_SSL === 'true',
  }),
);
