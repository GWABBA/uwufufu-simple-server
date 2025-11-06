import { UsersRepository } from './../../modules/users/users.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as postmark from 'postmark';
import { ConfigService } from '@nestjs/config';
import { EmailTokensRepository } from 'src/modules/email-tokens/email-tokens.repository';
import { randomBytes } from 'crypto';
import { EmailTokenPurpose } from 'src/modules/email-tokens/entities/email-token.entity';

@Injectable()
export class EmailService {
  private client: postmark.ServerClient;
  private blockDomains = [];
  private static readonly MAX_PER_HOUR = 3;
  private static readonly WINDOW_MINUTES = 60;

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
    if (this.isBlockedDomain(to)) {
      throw new BadRequestException(
        'This email domain is blocked from receiving confirmation emails. Contact support if you need assistance.',
      );
    }

    const user = await this.usersRepository.findOneBy({
      email: to,
      deletedAt: null,
    });
    if (!user) {
      // Silently ignore to avoid enumeration (optional)
      return;
    }
    if (user.isVerified) {
      throw new BadRequestException('Your email is already verified');
    }

    await this.ensureWithinRateLimit(user.id, EmailTokenPurpose.CONFIRMATION);

    const token = randomBytes(32).toString('hex');
    await this.emailTokensRepository.save({
      user,
      token,
      purpose: EmailTokenPurpose.CONFIRMATION,
    });

    const confirmationUrl = `${this.configService.get<string>(
      'app.frontUrl',
    )}/auth/email-confirmation?token=${token}`;

    const subject = 'Please confirm your email address';
    const body = `
Hello, ${user.name ?? ''}

Thank you for registering with UwUFUFU!

Please confirm your email address by clicking the link below:

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
    if (this.isBlockedDomain(to)) {
      throw new BadRequestException(
        'This email domain is blocked from receiving password reset emails. Contact support if you need assistance.',
      );
    }

    const user = await this.usersRepository.findOneBy({
      email: to,
      deletedAt: null,
    });
    if (!user) {
      // Silently succeed to avoid leaking which emails exist (optional)
      return;
    }

    await this.ensureWithinRateLimit(user.id, EmailTokenPurpose.PASSWORD_RESET);

    // Log the reset send in the same table (purpose-separated)
    await this.emailTokensRepository.save({
      user,
      token,
      purpose: EmailTokenPurpose.PASSWORD_RESET,
    });

    const passwordResetUrl = `${this.configService.get<string>(
      'app.frontUrl',
    )}/password-reset?token=${token}`;

    const subject = 'Password reset request';
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

  private humanPurpose(purpose: EmailTokenPurpose) {
    return purpose === EmailTokenPurpose.CONFIRMATION
      ? 'Confirmation'
      : 'Password reset';
  }

  private async ensureWithinRateLimit(
    userId: number,
    purpose: EmailTokenPurpose,
  ) {
    const since = new Date(Date.now() - EmailService.WINDOW_MINUTES * 60_000);
    const count = await this.emailTokensRepository.countForUserSince(
      userId,
      purpose,
      since,
    );
    if (count >= EmailService.MAX_PER_HOUR) {
      throw new BadRequestException(
        `You've requested too many ${this.humanPurpose(purpose).toLowerCase()} emails. Please try again later.`,
      );
    }
  }
}
