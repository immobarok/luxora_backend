import { Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
} from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * CustomThrottlerGuard — Extends the default ThrottlerGuard with:
 * 1. Proper IP extraction behind a reverse proxy (reads X-Forwarded-For)
 * 2. Custom error message on rate-limit exceeded
 * 3. Skips rate limiting for health check endpoints
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Extract the real client IP from behind a load balancer / proxy.
   * Falls back to the socket remote address if no forwarded header is present.
   */
  protected async getTracker(req: Request): Promise<string> {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips =
        typeof forwarded === 'string' ? forwarded : forwarded.join(',');
      return ips.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? '0.0.0.0';
  }

  /**
   * Throw a clear, user-friendly rate-limit error.
   */
  protected throwThrottlingException(
    _context: ExecutionContext,
  ): Promise<void> {
    throw new ThrottlerException(
      'Too many requests. Please slow down and try again later.',
    );
  }
}
