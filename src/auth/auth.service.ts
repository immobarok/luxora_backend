import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, genSalt, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import {
  RegisterDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from './dto';
import { Role, type User } from '@prisma/client';
import {
  AuthTokensEntity,
  MessageResponseEntity,
  RegisterResponseEntity,
} from './entities';

type AuthenticatedUser = Omit<User, 'passwordHash'>;

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
  jti?: string; // JWT ID — used for token blacklisting
  exp?: number; // JWT expiry (Unix timestamp)
  iat?: number; // JWT issued-at (Unix timestamp)
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
    private mail: MailService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Registration
  // ──────────────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<RegisterResponseEntity> {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new BadRequestException('User already exists');
    }

    const salt = (await genSalt()) as string;
    const passwordHash = (await hash(dto.password, salt)) as string;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || Role.CUSTOMER,
      },
    });

    const otp = this.generateSecureOtp();
    await this.redis.set(
      `verify_email:${user.email}`,
      otp,
      Number(process.env.OTP_EXPIRY_SECONDS),
    );

    // Fire-and-forget: don't block the response waiting for SMTP
    this.mail.sendVerificationOtp(user.email, otp).catch((err) => {
      this.logger.error(
        `Failed to send verification email to ${user.email}`,
        err.stack,
      );
    });

    return {
      message: 'User registered. Please check email for OTP.',
      role: user.role,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────────────────────

  async validateUser(
    email: string,
    pass: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return null;
    }

    if (await compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Login — issues access + refresh tokens; stores refresh token in Redis
  // ──────────────────────────────────────────────────────────────────────────

  async login(user: AuthenticatedUser): Promise<AuthTokensEntity> {
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Unique JWT ID for this session — enables per-token revocation
    const jti = randomBytes(16).toString('hex');

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      jti,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshExpiresIn =
      (process.env.JWT_REFRESH_EXPIRES_IN as StringValue) ??
      ('15d' as StringValue);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn,
    });

    // Store refresh token in Redis so it can be revoked on logout/password-change
    const refreshTtlSeconds = this.parseDurationToSeconds(
      refreshExpiresIn as string,
    );
    await this.redis.set(
      `refresh_token:${user.id}:${jti}`,
      refreshToken,
      refreshTtlSeconds,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Logout — blacklists the access token and removes the refresh token
  // ──────────────────────────────────────────────────────────────────────────

  async logout(accessToken: string): Promise<MessageResponseEntity> {
    try {
      const payload = this.jwtService.decode<JwtPayload>(accessToken);
      if (payload?.sub && payload?.jti) {
        // Blacklist access token until its natural expiry
        const exp = payload.exp ?? 0;
        const ttlSeconds = Math.max(exp - Math.floor(Date.now() / 1000), 0);
        if (ttlSeconds > 0) {
          await this.redis.set(
            `blacklist:${payload.jti}`,
            '1',
            ttlSeconds,
          );
        }
        // Remove the refresh token from Redis
        await this.redis.del(`refresh_token:${payload.sub}:${payload.jti}`);
      }
    } catch (err) {
      this.logger.warn('Logout: failed to decode token', err);
    }
    return { message: 'Logged out successfully' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check if a JWT is blacklisted (called by JwtStrategy)
  // ──────────────────────────────────────────────────────────────────────────

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const val = await this.redis.get(`blacklist:${jti}`);
    return val !== null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Email Verification
  // ──────────────────────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto): Promise<MessageResponseEntity> {
    const storedOtp = await this.redis.get(`verify_email:${dto.email}`);
    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { isEmailVerified: true, emailVerifiedAt: new Date() },
    });

    await this.redis.del(`verify_email:${dto.email}`);
    return { message: 'Email verified successfully' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Forgot Password
  // ──────────────────────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseEntity> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Always return the same message to prevent user enumeration
    if (!user) return { message: 'If email exists, OTP sent' };

    const otp = this.generateSecureOtp();
    await this.redis.set(
      `reset_password:${dto.email}`,
      otp,
      Number(process.env.OTP_EXPIRY_SECONDS),
    );

    // Fire-and-forget: don't block the response waiting for SMTP
    this.mail.sendPasswordResetOtp(dto.email, otp).catch((err) => {
      this.logger.error(
        `Failed to send password reset email to ${dto.email}`,
        err.stack,
      );
    });

    return { message: 'If email exists, OTP sent' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reset Password
  // ──────────────────────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseEntity> {
    const storedOtp = await this.redis.get(`reset_password:${dto.email}`);
    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const salt = (await genSalt()) as string;
    const passwordHash = (await hash(dto.newPassword, salt)) as string;

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { passwordHash },
    });

    await this.redis.del(`reset_password:${dto.email}`);

    // Invalidate ALL active refresh tokens for this user after password change
    await this.revokeAllUserTokens(dto.email);

    return { message: 'Password reset successfully' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Refresh Token — validates stored token, issues new pair (rotation)
  // ──────────────────────────────────────────────────────────────────────────

  async refreshToken(dto: RefreshTokenDto): Promise<AuthTokensEntity> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if the refresh token is still in Redis (not revoked)
    if (payload.jti) {
      const stored = await this.redis.get(
        `refresh_token:${payload.sub}:${payload.jti}`,
      );
      if (!stored || stored !== dto.refreshToken) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }
      // Revoke old token (rotation — each refresh token can only be used once)
      await this.redis.del(`refresh_token:${payload.sub}:${payload.jti}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return this.login(user);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // OAuth Login
  // ──────────────────────────────────────────────────────────────────────────

  async validateOAuthLogin(profile: any): Promise<AuthenticatedUser> {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.email },
          profile.provider === 'google'
            ? { googleId: profile.providerId }
            : { facebookId: profile.providerId },
        ],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          googleId: profile.provider === 'google' ? profile.providerId : null,
          facebookId:
            profile.provider === 'facebook' ? profile.providerId : null,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          role: Role.CUSTOMER,
        },
      });
    } else {
      if (profile.provider === 'google' && !user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.providerId },
        });
      } else if (profile.provider === 'facebook' && !user.facebookId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { facebookId: profile.providerId },
        });
      }
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates a cryptographically secure 6-digit OTP.
   * Uses crypto.randomBytes instead of Math.random() to prevent predictability.
   */
  private generateSecureOtp(): string {
    // Generate a random number in [0, 1000000) using randomBytes
    const bytes = randomBytes(4);
    const randomNum = bytes.readUInt32BE(0) % 1000000;
    return randomNum.toString().padStart(6, '0');
  }

  /**
   * Parse a duration string like "7d", "15m", "1h" into seconds.
   */
  private parseDurationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 7 * 24 * 3600; // Default 7 days
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 1);
  }

  /**
   * Revoke all active refresh tokens for a user (used after password reset).
   * Pattern-based deletion via Redis scan.
   */
  private async revokeAllUserTokens(email: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) return;
      // Note: This requires Redis SCAN support — ioredis supports it natively
      // Deletes all `refresh_token:<userId>:*` keys
      const pattern = `refresh_token:${user.id}:*`;
      await this.redis.deletePattern(pattern);
    } catch (err) {
      this.logger.warn('Failed to revoke user tokens', err);
    }
  }
}
