import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthRegisterBodyDto,
  AuthUpdateNameBodyDto,
  AuthUpdateUserBodyDto,
} from './dtos/auth-register-body.dto';
import { AuthResponseDto } from './dtos/auth-response.dto';
import { UsersRepository } from '../users/users.repository';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthLoginBodyDto } from './dtos/auth-login-body.dto';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '../users/dtos/user.dto';
import { MessageResponseDto } from 'src/core/dtos/message-response.dto';
import { UserFromToken } from './types/auth-request.interface';
import { EmailService } from 'src/core/email/email.service';
import { AuthEmailVerificationDto } from './dtos/auth-email-verification.dto';
import { EmailTokensRepository } from '../email-tokens/email-tokens.repository';
import { IsNull, Not } from 'typeorm';
import { ChangePasswordBodyDto } from './dtos/change-password-body.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly emailService: EmailService,
    private readonly emailTokensRepository: EmailTokensRepository,
  ) {}

  async register(
    authRegisterBodyDto: AuthRegisterBodyDto,
  ): Promise<AuthResponseDto> {
    const { email, name, password } = authRegisterBodyDto;

    // Check if user already exists
    const existingUser = await this.usersRepository.findOneBy({ email });
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    // Hash the password
    const saltRounds = 5;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the user
    const user = this.usersRepository.create({
      email,
      name,
      password: hashedPassword,
    });

    await this.usersRepository.save(user);
    try {
      await this.emailService.sendEmailConfirmationEmail(email);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.log(error);
    }

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
    };
  }

  async updateMe(
    user: UserFromToken,
    authUpdateUserBodyDto: AuthUpdateUserBodyDto,
  ): Promise<UserResponseDto> {
    const { name, profileImage } = authUpdateUserBodyDto;

    const userFromDb = await this.usersRepository.findOneBy({
      id: user.userId,
    });

    if (!userFromDb) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = {
      ...userFromDb,
      name: name || userFromDb.name,
      profileImage: profileImage || userFromDb.profileImage,
    };

    await this.usersRepository.update(user.userId, updatedUser);

    return plainToInstance(UserResponseDto, updatedUser);
  }

  async updateName(
    user: UserFromToken,
    authUpdateNameBodyDto: AuthUpdateNameBodyDto,
  ): Promise<UserResponseDto> {
    const { name } = authUpdateNameBodyDto;

    const userFromDb = await this.usersRepository.findOneBy({
      id: user.userId,
    });

    if (!userFromDb) {
      throw new NotFoundException('User not found');
    }

    // 🔍 Check for duplicate name (used by another user)
    const duplicateUser = await this.usersRepository.findOne({
      where: {
        name,
        id: Not(user.userId),
      },
    });

    if (duplicateUser) {
      throw new ConflictException('This name is already taken');
    }

    await this.usersRepository.update(user.userId, { name });

    return plainToInstance(UserResponseDto, {
      ...userFromDb,
      name,
    });
  }

  async login(authLoginBodyDto: AuthLoginBodyDto): Promise<AuthResponseDto> {
    const { email, password } = authLoginBodyDto;

    // Check if user exists
    const user = await this.usersRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.password === null) {
      throw new UnauthorizedException('Please reset your password');
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return { accessToken: token };
  }

  async patchPassword(
    userFromToken: UserFromToken,
    changePasswordBodyDto: ChangePasswordBodyDto,
  ): Promise<MessageResponseDto> {
    const { newPassword } = changePasswordBodyDto;

    const user = await this.usersRepository.findOne({
      where: { id: userFromToken.userId, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const saltRounds = 5;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.usersRepository.update(user.id, { password: hashedPassword });

    return plainToInstance(MessageResponseDto, {
      message: 'Password updated successful',
    });
  }

  async fetchMe(user: UserFromToken): Promise<UserResponseDto> {
    const userFromDb = await this.usersRepository.findOneBy({
      id: user.userId,
    });
    // check tier and subscription end date
    if (!userFromDb) {
      throw new NotFoundException('User not found');
    }
    if (
      userFromDb.subscriptionEndDate &&
      userFromDb.subscriptionEndDate < new Date()
    ) {
      await this.usersRepository.update(user.userId, {
        tier: 'basic',
        subscriptionEndDate: null,
        subscriptionStartDate: null,
      });

      // ✅ Reload the user from the DB after the update
      userFromDb.tier = 'basic';
      userFromDb.subscriptionEndDate = null;
      userFromDb.subscriptionStartDate = null;
    }

    return plainToInstance(UserResponseDto, userFromDb);
  }

  async verifyEmail(
    user: UserFromToken,
    authEmailVerificationDto: AuthEmailVerificationDto,
  ): Promise<MessageResponseDto> {
    const { token } = authEmailVerificationDto;

    const emailToken = await this.emailTokensRepository.findOne({
      where: { token: token },
      relations: ['user'],
    });

    if (!emailToken) {
      throw new NotFoundException('Token not found');
    }

    if (emailToken.user.id !== user.userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    // ✅ Mark user as verified
    await this.usersRepository.update(user.userId, { isVerified: true });

    // ✅ Delete the token instead of marking it as used
    await this.emailTokensRepository.delete({ id: emailToken.id });

    return plainToInstance(MessageResponseDto, {
      message: 'Email verified',
    });
  }
}
