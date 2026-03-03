import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  context: Record<string, unknown>;
  attachments?: Mail.Attachment[];
  cc?: string | string[];
  bcc?: string | string[];
}

export enum EmailTemplate {
  VERIFICATION_OTP = 'verification-otp',
  PASSWORD_RESET_OTP = 'password-reset-otp',
  WELCOME = 'welcome',
  ORDER_CONFIRMATION = 'order-confirmation',
  PASSWORD_CHANGED = 'password-changed',
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool: boolean;
  maxConnections: number;
  rateDelta: number;
  rateLimit: number;
}

// ============================================================
// Template Registry
// ============================================================

type TemplateRenderer = (context: Record<string, unknown>) => {
  html: string;
  text: string;
};

function getContextString(
  context: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const value = context[key];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  return fallback;
}

function getContextNumber(
  context: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = context[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function formatAddress(address: Mail.Address): string {
  return address.address;
}

function formatRecipients(recipients: Mail.Options['to']): string {
  if (!recipients) {
    return 'unknown';
  }

  if (typeof recipients === 'string') {
    return recipients;
  }

  if (Array.isArray(recipients)) {
    return recipients
      .map((recipient) =>
        typeof recipient === 'string' ? recipient : formatAddress(recipient),
      )
      .join(', ');
  }

  return formatAddress(recipients);
}

const templates: Record<EmailTemplate, TemplateRenderer> = {
  [EmailTemplate.VERIFICATION_OTP]: (ctx) => ({
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #000; }
          .otp-code { background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .otp-code .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #000; font-family: monospace; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
          .button { display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Luxora</div>
          </div>
          <h2>Verify Your Email</h2>
          <p>Hello ${getContextString(ctx, 'name', 'there')},</p>
          <p>Use the verification code below to complete your email verification:</p>
          <div class="otp-code">
            <div class="code">${getContextString(ctx, 'otp', '')}</div>
          </div>
          <p>This code will expire in <strong>${getContextNumber(ctx, 'expiryMinutes', 5)} minutes</strong>.</p>
          <p>If you didn't request this code, you can safely ignore this email.</p>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Luxora. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Luxora - Verify Your Email\n\nHello ${getContextString(ctx, 'name', 'there')},\n\nYour verification code is: ${getContextString(ctx, 'otp', '')}\n\nThis code will expire in ${getContextNumber(ctx, 'expiryMinutes', 5)} minutes.\n\nIf you didn't request this code, you can safely ignore this email.\n\n© ${new Date().getFullYear()} Luxora!`,
  }),

  [EmailTemplate.PASSWORD_RESET_OTP]: (ctx) => ({
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #000; }
          .otp-code { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .otp-code .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #856404; font-family: monospace; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Luxora</div>
          </div>
          <h2>Reset Your Password</h2>
          <p>Hello ${getContextString(ctx, 'name', 'there')},</p>
          <p>We received a request to reset your password. Use the code below to proceed:</p>
          <div class="otp-code">
            <div class="code">${getContextString(ctx, 'otp', '')}</div>
          </div>
          <p>This code will expire in <strong>${getContextNumber(ctx, 'expiryMinutes', 5)} minutes</strong>.</p>
          <div class="warning">
            <strong>Didn't request this?</strong> If you didn't request a password reset, please ignore this email or contact support if you're concerned.
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Luxora. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Luxora - Reset Your Password\n\nHello ${getContextString(ctx, 'name', 'there')},\n\nYour password reset code is: ${getContextString(ctx, 'otp', '')}\n\nThis code will expire in ${getContextNumber(ctx, 'expiryMinutes', 5)} minutes.\n\nDidn't request this? Please ignore this email or contact support.\n\n© ${new Date().getFullYear()} Luxora!`,
  }),

  [EmailTemplate.WELCOME]: (ctx) => ({
    html: `<!DOCTYPE html><html><body><h1>Welcome to Luxora!, ${getContextString(ctx, 'name', 'there')}!</h1></body></html>`,
    text: `Welcome to Luxora!, ${getContextString(ctx, 'name', 'there')}!`,
  }),

  [EmailTemplate.ORDER_CONFIRMATION]: (ctx) => ({
    html: `<!DOCTYPE html><html><body><h1>Order Confirmed: #${getContextString(ctx, 'orderNumber', 'N/A')}</h1></body></html>`,
    text: `Order Confirmed: #${getContextString(ctx, 'orderNumber', 'N/A')}`,
  }),

  [EmailTemplate.PASSWORD_CHANGED]: () => ({
    html: `<!DOCTYPE html><html><body><h1>Password Changed Successfully</h1><p>If you didn't make this change, contact support immediately.</p></body></html>`,
    text: `Password Changed Successfully. If you didn't make this change, contact support immediately.`,
  }),
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.initializeTransporter();
    this.verifyConnection().catch((err) => {
      this.logger.warn(
        'Mail service verification failed - moving forward',
        err.message,
      );
    });
  }

  private initializeTransporter(): void {
    const port = Number(this.configService.getOrThrow('MAIL_PORT'));
    const secure = this.configService.get('MAIL_SECURE') === 'true';

    const config: SmtpConfig = {
      host: this.configService.getOrThrow<string>('MAIL_HOST'),
      port,
      secure,
      auth: {
        user: this.configService.getOrThrow<string>('MAIL_USER'),
        pass: this.configService.getOrThrow<string>('MAIL_PASSWORD'),
      },
      pool: true,
      maxConnections: 5,
      rateDelta: 1000,
      rateLimit: 5,
    };

    // If using port 587, we must NOT use implicit TLS (secure: true)
    // We use requireTLS to ensure it upgrades to STARTTLS
    if (!secure && port === 587) {
      (config as any).requireTLS = true;
      (config as any).tls = { rejectUnauthorized: false };
    }

    this.transporter = nodemailer.createTransport(config);

    this.transporter.on('idle', () => {
      this.logger.debug('SMTP connection idle');
    });

    this.transporter.on('error', (err) => {
      this.logger.error('SMTP connection error', err);
    });
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection established successfully');
    } catch (error) {
      this.logger.error('Failed to establish SMTP connection', error);
      throw error;
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const { to, subject, template, context, attachments, cc, bcc } = options;

    const templateRenderer = templates[template];
    if (!templateRenderer) {
      throw new Error(`Template "${template}" not found`);
    }

    const { html, text } = templateRenderer(context);

    const mailOptions: Mail.Options = {
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      to,
      cc,
      bcc,
      subject: `[Luxora] ${subject}`,
      text,
      html,
      attachments,
    };

    await this.sendWithRetry(mailOptions);
  }

  private async sendWithRetry(
    mailOptions: Mail.Options,
    attempt = 1,
  ): Promise<void> {
    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${formatRecipients(mailOptions.to)}`);
    } catch (error) {
      this.logger.warn(
        `Email send failed (attempt ${attempt}/${this.maxRetries})`,
        {
          error: error instanceof Error ? error.message : String(error),
          to: mailOptions.to,
        },
      );

      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelay * attempt);
        return this.sendWithRetry(mailOptions, attempt + 1);
      }

      this.logger.error('Email send failed after max retries', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new MailSendException(
        `Failed to send email to ${JSON.stringify(mailOptions.to)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================
  // Public API Methods
  // ============================================================

  async sendVerificationOtp(
    email: string,
    otp: string,
    name?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      template: EmailTemplate.VERIFICATION_OTP,
      context: {
        name: name || email.split('@')[0],
        otp,
        expiryMinutes: 5,
      },
    });
  }

  async sendPasswordResetOtp(
    email: string,
    otp: string,
    name?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      template: EmailTemplate.PASSWORD_RESET_OTP,
      context: {
        name: name || email.split('@')[0],
        otp,
        expiryMinutes: 5,
      },
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Luxora!',
      template: EmailTemplate.WELCOME,
      context: { name },
    });
  }

  async sendOrderConfirmation(
    email: string,
    orderNumber: string,
    name: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `Order Confirmation: #${orderNumber}`,
      template: EmailTemplate.ORDER_CONFIRMATION,
      context: { orderNumber, name },
    });
  }

  async sendPasswordChangedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Password Was Changed',
      template: EmailTemplate.PASSWORD_CHANGED,
      context: { name },
    });
  }
}

export class MailSendException extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'MailSendException';
  }
}
