import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  private readonly dangerousPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick=, onload=, etc.
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
  ];

  /**
   * Sanitize a single string value.
   */
  private sanitizeString(value: string): string {
    let sanitized = value;
    for (const pattern of this.dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }
    return sanitized.trim();
  }

  private sanitizeObject(obj: unknown, depth = 0): unknown {
    if (depth > 10) return obj;

    if (obj === null || obj === undefined) return obj;
    if (Buffer.isBuffer(obj)) return obj;

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, depth + 1));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value, depth + 1);
      }
      return sanitized;
    }

    return obj;
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }

      if (req.query && typeof req.query === 'object') {
        req.query = this.sanitizeObject(req.query) as Record<string, string>;
      }
    } catch (err) {
      console.error('🚨 SanitizeMiddleware Error:', err);
    }

    next();
  }
}
