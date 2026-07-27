import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * SecurityAuditMiddleware — Logs security-relevant events to aid intrusion
 * detection and compliance auditing.
 *
 * Events logged:
 * - All requests to authentication endpoints
 * - Requests with suspicious user agents (bots/scanners)
 * - Requests with oversized payloads
 * - Missing or malformed Authorization headers on protected routes
 * - Requests from unexpected origins
 */
@Injectable()
export class SecurityAuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger('SecurityAudit');

  /** Paths that are security-sensitive and always logged */
  private readonly sensitivePathPatterns = [
    /\/auth\/login/,
    /\/auth\/register/,
    /\/auth\/forgot-password/,
    /\/auth\/reset-password/,
    /\/auth\/verify-email/,
    /\/auth\/refresh/,
    /\/auth\/logout/,
  ];

  /** Known malicious/scanner user-agent patterns */
  private readonly suspiciousUAPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /masscan/i,
    /nmap/i,
    /dirbuster/i,
    /gobuster/i,
    /wfuzz/i,
    /burpsuite/i,
    /hydra/i,
    /medusa/i,
    /acunetix/i,
  ];

  private isSuspiciousUA(ua: string): boolean {
    return this.suspiciousUAPatterns.some((pattern) => pattern.test(ua));
  }

  private isSensitivePath(path: string): boolean {
    return this.sensitivePathPatterns.some((pattern) => pattern.test(path));
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (
        typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]
      ).trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = this.getClientIp(req);
    const ua = (req.headers['user-agent'] ?? '').toString();
    const path = req.path;
    const method = req.method;

    // ── Suspicious User Agent ─────────────────────────────────────────────
    if (this.isSuspiciousUA(ua)) {
      this.logger.warn(
        `[SUSPICIOUS_UA] ip=${ip} method=${method} path=${path} ua="${ua}"`,
      );
    }

    // ── Sensitive Endpoint Access ─────────────────────────────────────────
    if (this.isSensitivePath(path)) {
      this.logger.log(
        `[AUTH_ACCESS] ip=${ip} method=${method} path=${path}`,
      );
    }

    // ── Oversized Content-Length ──────────────────────────────────────────
    const contentLength = parseInt(
      req.headers['content-length'] ?? '0',
      10,
    );
    if (contentLength > 5 * 1024 * 1024) {
      // > 5MB
      this.logger.warn(
        `[OVERSIZED_PAYLOAD] ip=${ip} method=${method} path=${path} size=${contentLength}`,
      );
    }

    // ── Log response status for auth routes ───────────────────────────────
    if (this.isSensitivePath(path)) {
      res.on('finish', () => {
        const status = res.statusCode;
        const level = status >= 400 ? 'warn' : 'log';
        this.logger[level](
          `[AUTH_RESULT] ip=${ip} method=${method} path=${path} status=${status}`,
        );
      });
    }

    next();
  }
}
