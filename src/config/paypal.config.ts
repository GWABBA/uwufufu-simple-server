import { registerAs } from '@nestjs/config';

export default registerAs(
  'paypal',
  (): Record<string, any> => ({
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  }),
);
