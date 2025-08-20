import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { AuthRequest } from '../auth/types/auth-request.interface';

@Controller('stripe') // final path => /v1/stripe/...
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  // POST /v1/stripe/checkout-session -> { id, url }
  @Post('checkout-session')
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @Body()
    body: {
      priceId?: string;
      successUrl?: string;
      cancelUrl?: string;
    },
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    // Your auth layer should populate req.user
    const user = req.user;

    const session = await this.stripe.createCheckoutForUser({
      userId: user.userId,
      email: user.email ?? null,
      priceId: body.priceId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    return res.status(200).json({ id: session.id, url: session.url });
  }

  // GET /v1/stripe/checkout-session?session_id=...
  @Get('checkout-session')
  async getCheckoutSession(
    @Query('session_id') sessionId: string,
    @Res() res: Response,
  ) {
    if (!sessionId) throw new BadRequestException('session_id is required');
    const session = await this.stripe.getCheckoutSession(sessionId);
    return res.status(200).json(session);
  }

  // GET /v1/stripe/portal?customerId=...&returnUrl=...
  @Get('portal')
  async createPortal(
    @Query('customerId') customerId: string,
    @Query('returnUrl') returnUrl: string,
    @Res() res: Response,
  ) {
    if (!customerId) throw new BadRequestException('customerId is required');
    const session = await this.stripe.createBillingPortalSession(
      customerId,
      returnUrl || 'https://uwufufu.com/account',
    );
    return res.status(200).json({ url: session.url });
  }

  // stripe.controller.ts
  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response) {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const raw = (req as any).rawBody as Buffer | undefined;

    // Optional quick checks/logs
    // console.log('[webhook] hasSig=', !!sig, 'rawLen=', raw?.length);

    if (!sig) return res.status(400).send('Missing signature header');
    if (!raw) return res.status(400).send('Missing raw body');

    try {
      const event = this.stripe.constructWebhookEvent(raw, sig); // <-- use the service method
      await this.stripe.handleEvent(event);
      return res.send(); // 200
    } catch (e: any) {
      // console.error('[webhook] verify failed:', e?.message);
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }
  }
}
