import { Body, Controller, Patch, Post } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { CreatePasswordResetDto } from './dtos/create-password-reset.dto';
import { MessageResponseDto } from 'src/core/dtos/message-response.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';

@Controller('password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Patch()
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
    return await this.passwordResetService.resetPassword(resetPasswordDto);
  }

  @Post()
  async createPasswordReset(
    @Body() createPasswordResetDto: CreatePasswordResetDto,
  ): Promise<MessageResponseDto> {
    return await this.passwordResetService.createPasswordReset(
      createPasswordResetDto,
    );
  }
}
