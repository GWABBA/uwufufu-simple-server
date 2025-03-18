import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { AuthRequest } from '../auth/types/auth-request.interface';
import { PaymentResponseDto } from './dtos/payment-response.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('/latest-subscription')
  @UseGuards(JwtAuthGuard)
  async fetchLatestSubscription(
    @Req() req: AuthRequest,
  ): Promise<PaymentResponseDto> {
    const user = req.user;
    return this.paymentsService.fetchLatestSubscription(user);
  }

  @Post('cancel-subscription')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(@Req() req: AuthRequest) {
    const user = req.user;
    return this.paymentsService.cancelSubscription(user);
  }
}
