import { registerAs } from '@nestjs/config';

export default registerAs(
  'r2',
  (): Record<string, any> => ({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT,
    bucketName: process.env.R2_BUCKET_NAME,
    url: process.env.R2_URL,
  }),
);
