import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AuthRegisterBodyDto,
  AuthUpdateNameBodyDto,
  AuthUpdateUserBodyDto,
} from './dtos/auth-register-body.dto';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dtos/auth-response.dto';
import { AuthLoginBodyDto } from './dtos/auth-login-body.dto';
import { UserResponseDto } from '../users/dtos/user.dto';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { MessageResponseDto } from 'src/core/dtos/message-response.dto';
import { AuthRequest } from './types/auth-request.interface';
import { AuthEmailVerificationDto } from './dtos/auth-email-verification.dto';
import { ChangePasswordBodyDto } from './dtos/change-password-body.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  async getGames(
    @Body() authRegisterBodyDto: AuthRegisterBodyDto,
  ): Promise<AuthResponseDto> {
    return this.authService.register(authRegisterBodyDto);
  }

  @Post('/login')
  async login(
    @Body() authLoginBodyDto: AuthLoginBodyDto,
  ): Promise<AuthResponseDto> {
    return this.authService.login(authLoginBodyDto);
  }

  @Get('/me')
  @UseGuards(JwtAuthGuard)
  async fetchMe(@Req() req: AuthRequest): Promise<UserResponseDto> {
    const user = req.user;
    return this.authService.fetchMe(user);
  }

  @Put('/me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @Req() req: AuthRequest,
    @Body() authUpdateBodyDto: AuthUpdateUserBodyDto,
  ): Promise<UserResponseDto> {
    const user = req.user;
    return this.authService.updateMe(user, authUpdateBodyDto);
  }

  @Put('/me/name')
  @UseGuards(JwtAuthGuard)
  async updateName(
    @Req() req: AuthRequest,
    @Body() authUpdateNameBodyDto: AuthUpdateNameBodyDto,
  ): Promise<UserResponseDto> {
    const user = req.user;
    return this.authService.updateName(user, authUpdateNameBodyDto);
  }

  @Patch('/password')
  @UseGuards(JwtAuthGuard)
  async patchPassword(
    @Req() req: AuthRequest,
    @Body() changePasswordBodyDto: ChangePasswordBodyDto,
  ): Promise<MessageResponseDto> {
    const user = req.user;
    return this.authService.patchPassword(user, changePasswordBodyDto);
  }

  @Patch('/verify-email')
  @UseGuards(JwtAuthGuard)
  async verifyEmail(
    @Req() req: AuthRequest,
    @Body() authEmailVerificationDto: AuthEmailVerificationDto,
  ): Promise<MessageResponseDto> {
    const user = req.user;
    return this.authService.verifyEmail(user, authEmailVerificationDto);
  }

  @Post('/cancel-subscription')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(
    @Req() req: AuthRequest,
  ): Promise<MessageResponseDto> {
    const user = req.user;
    return this.authService.cancelSubscription(user);
  }
}
