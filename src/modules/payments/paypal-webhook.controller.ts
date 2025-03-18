import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { PaypalWebhookService } from './paypal-webhook.service';

@Controller('paypal-webhook')
export class PaypalWebhookController {
  constructor(private paypalWebhookService: PaypalWebhookService) {}

  @Post()
  async handleWebhook(@Req() req, @Res() res) {
    try {
      const event = req.body;
      await this.paypalWebhookService.handleWebhook(event);
      return res.status(HttpStatus.OK).json({ message: 'Webhook received' });
    } catch (error) {
      console.error('Error handling PayPal webhook:', error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Webhook processing failed' });
    }
  }
}
