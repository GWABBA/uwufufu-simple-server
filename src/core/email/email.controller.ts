import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthRequest } from 'src/modules/auth/types/auth-request.interface';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('email-confirmation')
  @UseGuards(JwtAuthGuard)
  async sendEmail(@Req() req: AuthRequest) {
    const user = req.user;
    const to = user.email;
    await this.emailService.sendEmailConfirmationEmail(to);
    return { success: true, message: 'Email sent!' };
  }
}
