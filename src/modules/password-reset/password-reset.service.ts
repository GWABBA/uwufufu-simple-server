import { ResetPasswordDto } from './dtos/reset-password.dto';
import { CreatePasswordResetDto } from './dtos/create-password-reset.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PasswordResetRepository } from './password-reset.repository';
import { UsersRepository } from '../users/users.repository';
import { IsNull, MoreThan } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { MessageResponseDto } from 'src/core/dtos/message-response.dto';
import { randomBytes } from 'crypto';
import { EmailService } from 'src/core/email/email.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly usersRepository: UsersRepository,
    private readonly emailService: EmailService,
  ) {}

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    const passwordReset = await this.passwordResetRepository.findOne({
      where: {
        token,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()), // ✅ Ensures the token hasn't expired
      },
    });

    if (!passwordReset) {
      throw new NotFoundException('This is not a valid url. Please try again.');
    }

    const user = await this.usersRepository.findOne({
      where: { email: passwordReset.email, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const saltRounds = 5;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await this.usersRepository.update(user.id, { password: hashedPassword });

    await this.passwordResetRepository.update(passwordReset.id, {
      usedAt: new Date(),
    });

    return plainToInstance(MessageResponseDto, {
      message: 'Password reset successful',
    });
  }

  async createPasswordReset(
    createPasswordResetDto: CreatePasswordResetDto,
  ): Promise<MessageResponseDto> {
    const { email } = createPasswordResetDto;

    const user = await this.usersRepository.findOne({
      where: { email, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = randomBytes(32).toString('hex');

    const passwordReset = await this.passwordResetRepository.create({
      email,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    await this.passwordResetRepository.save(passwordReset);
    await this.emailService.sendPasswordResetEmail(email, token);

    // Send email with password reset

    return plainToInstance(MessageResponseDto, {
      message: 'Password reset email sent',
    });
  }
}
