import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  private readonly dangerousPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
  ];

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
        Object.defineProperty(req, 'query', {
          value: this.sanitizeObject(req.query),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    } catch (err) {
      console.error('🚨 SanitizeMiddleware Error:', err);
    }

    next();
  }
}
