import { UsersRepository } from './../../modules/users/users.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as postmark from 'postmark';
import { ConfigService } from '@nestjs/config';
import { EmailTokensRepository } from 'src/modules/email-tokens/email-tokens.repository';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailService {
  private client: postmark.ServerClient;
  private blockDomains = ['tiscali.it', 'telenet.be'];

  constructor(
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly emailTokensRepository: EmailTokensRepository,
  ) {
    this.client = new postmark.ServerClient(
      this.configService.get<string>('postmark.apiTokens'),
    );
  }

  async sendEmailConfirmationEmail(to: string) {
    // Check if the email is blocked
    if (this.isBlockedDomain(to)) {
      throw new BadRequestException(
        'This email domain is blocked from receiving confirmation emails. Contact support if you need assistance.',
      );
    }

    // check if user isVerified
    const user = await this.usersRepository.findOneBy({
      email: to,
      deletedAt: null,
    });

    if (user.isVerified) {
      throw new BadRequestException('Your email is already verified');
    }

    const token = randomBytes(32).toString('hex');

    await this.emailTokensRepository.save({
      user,
      token,
    });

    const confirmationUrl = `${this.configService.get<string>(
      'app.frontUrl',
    )}/auth/email-confirmation?token=${token}`;

    const subject = 'Please confirm your email address';
    const body = `
      Hello, ${user.name}.

      Thank you for registering with UwUFUFU!

      Please confirm your email address by clicking the link below

      ${confirmationUrl}

      Best,  
      UwUFUFU Team
    `;

    await this.client.sendEmail({
      From: 'noreply@uwufufu.com',
      To: to,
      Subject: subject,
      TextBody: body,
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    // Check if the email is blocked
    if (this.isBlockedDomain(to)) {
      throw new BadRequestException(
        'This email domain is blocked from receiving password reset emails. Contact support if you need assistance.',
      );
    }
    const subject = 'Password reset request';
    const passwordResetUrl = `${this.configService.get<string>(
      'app.frontUrl',
    )}/password-reset?token=${token}`;

    const body = `
      Hello,

      We received a request to reset your password. If this was you, click the link below to set a new password:

      ${passwordResetUrl}

      If you didn't request a password reset, you can safely ignore this email.

      This link will expire in 1 hour for security reasons.

      Best,  
      UwUFUFU Team
    `;

    await this.client.sendEmail({
      From: 'noreply@uwufufu.com',
      To: to,
      Subject: subject,
      TextBody: body,
    });
  }

  private isBlockedDomain(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return this.blockDomains.includes(domain);
  }
}
