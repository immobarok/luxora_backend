import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto';
import {
  AuthTokensEntity,
  MessageResponseEntity,
  ProfileEntity,
  RegisterResponseEntity,
} from './entities';
import type { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseEntity> {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(
    @Request() req: { user: Omit<User, 'passwordHash'> },
  ): AuthTokensEntity {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<MessageResponseEntity> {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<MessageResponseEntity> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<MessageResponseEntity> {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensEntity> {
    return this.authService.refreshToken(dto);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuth(@Request() req: any) {
    // Redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req: any, @Res() res: Response) {
    const user = await this.authService.validateOAuthLogin(req.user);
    const tokens = this.authService.login(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
    );
  }

  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async facebookAuth(@Request() req: any) {
    // Redirects to Facebook
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Request() req: any, @Res() res: Response) {
    const user = await this.authService.validateOAuthLogin(req.user);
    const tokens = this.authService.login(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
    );
  }

  @Get('me')
  getProfile(@CurrentUser() user: ProfileEntity): ProfileEntity {
    return user;
  }
}
