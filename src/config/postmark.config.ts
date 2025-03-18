import { registerAs } from '@nestjs/config';

export default registerAs(
  'postmark',
  (): Record<string, any> => ({
    apiTokens: process.env.POSTMARK_API_TOKENS,
  }),
);
