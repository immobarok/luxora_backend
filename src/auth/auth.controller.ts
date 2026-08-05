import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
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
import { LocalAuthGuard } from './guards/local-auth.guard';
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensEntity> {
    const tokens = await this.authService.login(req.user);

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days matching auth service
      path: '/api/v1/auth/refresh',
    });

    return tokens;
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('authorization') authHeader: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseEntity> {
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';

    // Clear the refresh token cookie
    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/api/v1/auth/refresh',
    });

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
  async refresh(
    @Req() req: any,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensEntity> {
    const refreshToken = req.cookies?.refresh_token || dto.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refreshToken({ refreshToken });

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    return tokens;
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() _req: any) {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req: any, @Res() res: Response) {
    const user = await this.authService.validateOAuthLogin(req.user);
    const tokens = await this.authService.login(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.cookie('access_token', tokens.access_token, {
      httpOnly: false,
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

  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
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
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
