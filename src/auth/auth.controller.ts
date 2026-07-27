import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
  Res,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
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

/**
 * Auth limits:
 *  - Sensitive mutations (login/register/otp): 5 requests per 60 seconds
 *  - Refresh: 20 requests per 60 seconds
 */
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const REFRESH_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Registration ──────────────────────────────────────────────────────────

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseEntity> {
    return this.authService.register(dto);
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  @Public()
  @Throttle(AUTH_THROTTLE)
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Request() req: { user: Omit<User, 'passwordHash'> },
  ): Promise<AuthTokensEntity> {
    return this.authService.login(req.user);
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('authorization') authHeader: string,
  ): Promise<MessageResponseEntity> {
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
    return this.authService.logout(token);
  }

  // ── Email Verification ────────────────────────────────────────────────────

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<MessageResponseEntity> {
    return this.authService.verifyEmail(dto);
  }

  // ── Forgot / Reset Password ───────────────────────────────────────────────

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<MessageResponseEntity> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<MessageResponseEntity> {
    return this.authService.resetPassword(dto);
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────

  @Public()
  @Throttle(REFRESH_THROTTLE)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensEntity> {
    return this.authService.refreshToken(dto);
  }

  // ── OAuth — Google ────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuth(@Request() _req: any) {
    // Passport redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req: any, @Res() res: Response) {
    const user = await this.authService.validateOAuthLogin(req.user);
    const tokens = await this.authService.login(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // ✅ Security: tokens set as HttpOnly cookies instead of query params
    //    This prevents token leakage via browser history and server logs.
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth/refresh', // Scope refresh cookie to only the refresh endpoint
    });

    return res.redirect(`${frontendUrl}/auth/callback?oauth=success`);
  }

  // ── OAuth — Facebook ──────────────────────────────────────────────────────

  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async facebookAuth(@Request() _req: any) {
    // Passport redirects to Facebook
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Request() req: any, @Res() res: Response) {
    const user = await this.authService.validateOAuthLogin(req.user);
    const tokens = await this.authService.login(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // ✅ Security: tokens set as HttpOnly cookies instead of query params
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth/refresh',
    });

    return res.redirect(`${frontendUrl}/auth/callback?oauth=success`);
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  @Get('me')
  getProfile(@CurrentUser() user: ProfileEntity): ProfileEntity {
    return user;
  }
}
