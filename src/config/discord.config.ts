import { registerAs } from '@nestjs/config';

export default registerAs(
  'discord',
  (): Record<string, any> => ({
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  }),
); 