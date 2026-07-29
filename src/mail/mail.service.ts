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
  ORDER_DELIVERED_REVIEW = 'order-delivered-review',
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



type TemplateRenderer = (context: Record<string, unknown>) => {
  html: string;
  text: string;
};

function str(ctx: Record<string, unknown>, key: string, fallback = ''): string {
  const v = ctx[key];
  if (typeof v === 'string') return v.trim() || fallback;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint')
    return String(v);
  return fallback;
}

function num(
  ctx: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = ctx[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const p = Number(v);
    if (Number.isFinite(p)) return p;
  }
  return fallback;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatAddress(ctx: Record<string, unknown>): string {
  const addr = ctx['shippingAddress'] as Record<string, string> | undefined;
  if (!addr) return '';
  const parts = [
    addr['name'],
    addr['addressLine1'],
    addr['addressLine2'],
    `${addr['city']}, ${addr['state']} ${addr['postalCode']}`,
    addr['country'],
    addr['phone'],
  ].filter(Boolean);
  return parts.join('<br>');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function baseTemplate({
  title,
  preheader,
  content,
}: {
  title: string;
  preheader: string;
  content: string;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#fff;font-family:Arial,sans-serif;color:#111;"><div style="max-width:600px;margin:0 auto;padding:32px 24px;"><div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>${content}<p style="margin-top:32px;color:#888;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Luxora. All rights reserved.</p></div></body></html>`;
}

function formatAddressText(ctx: Record<string, unknown>): string {
  const addr = ctx['shippingAddress'] as Record<string, string> | undefined;
  if (!addr) return '';
  const parts = [
    addr['name'],
    addr['addressLine1'],
    addr['addressLine2'],
    `${addr['city']}, ${addr['state']} ${addr['postalCode']}`,
    addr['country'],
  ].filter(Boolean);
  return parts.join(', ');
}

// ── Shared CSS tokens ──────────────────────────────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background-color: #f1f5f9;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1e293b;
    -webkit-text-size-adjust: 100%;
  }
  .email-wrapper {
    background-color: #f1f5f9;
    padding: 40px 20px;
  }
  .email-card {
    background: #ffffff;
    border-radius: 16px;
    max-width: 600px;
    margin: 0 auto;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -1px rgba(0,0,0,.04);
  }
  /* Header */
  .email-header {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    padding: 36px 40px 32px;
    text-align: center;
  }
  .brand-name {
    font-size: 26px;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: 4px;
    text-transform: uppercase;
  }
  .brand-tagline {
    font-size: 11px;
    color: #94a3b8;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 4px;
  }
  /* Body */
  .email-body {
    padding: 40px 40px 36px;
  }
  .greeting {
    font-size: 22px;
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 12px;
  }
  .paragraph {
    font-size: 15px;
    color: #475569;
    line-height: 1.7;
    margin-bottom: 16px;
  }
  /* Divider */
  .divider {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 28px 0;
  }
  /* Footer */
  .email-footer {
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 24px 40px;
    text-align: center;
  }
  .footer-text {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.6;
  }
  .footer-links a {
    color: #64748b;
    text-decoration: none;
    font-size: 12px;
    margin: 0 8px;
  }
`;

// ── OTP Box shared component ───────────────────────────────────────────────
const OTP_BOX_CSS = `
  .otp-container {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 12px;
    padding: 32px 20px;
    text-align: center;
    margin: 28px 0;
  }
  .otp-label {
    font-size: 11px;
    color: #94a3b8;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .otp-digits {
    display: inline-block;
    font-size: 40px;
    font-weight: 700;
    letter-spacing: 12px;
    color: #f8fafc;
    font-family: 'Courier New', monospace;
    background: rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 12px 24px;
  }
  .otp-expiry {
    font-size: 13px;
    color: #64748b;
    margin-top: 12px;
  }
  .otp-expiry span { color: #f59e0b; font-weight: 600; }
`;

// ── CTA Button ─────────────────────────────────────────────────────────────
const BTN_CSS = `
  .cta-wrapper { text-align: center; margin: 28px 0; }
  .cta-btn {
    display: inline-block;
    background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
    color: #f8fafc !important;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    padding: 14px 32px;
    border-radius: 8px;
    letter-spacing: 0.5px;
  }
`;

// ── Alert / Notice block ───────────────────────────────────────────────────
const ALERT_CSS = `
  .alert {
    border-radius: 8px;
    padding: 16px 20px;
    font-size: 14px;
    line-height: 1.6;
    margin: 20px 0;
  }
  .alert-warning {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #78350f;
  }
  .alert-danger {
    background: #fef2f2;
    border-left: 4px solid #ef4444;
    color: #7f1d1d;
  }
  .alert-success {
    background: #f0fdf4;
    border-left: 4px solid #22c55e;
    color: #14532d;
  }
`;

// ============================================================
// 1. WELCOME EMAIL
// ============================================================
function welcomeTemplate(ctx: Record<string, unknown>): { html: string; text: string } {
  const name = str(ctx, 'name', 'there');
  const shopUrl = str(ctx, 'shopUrl', 'https://luxora.com');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to Luxora</title>
  <style>
    ${BASE_CSS}
    ${BTN_CSS}
    .hero-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    .features-grid {
      display: table;
      width: 100%;
      margin: 24px 0;
    }
    .feature-row { display: table-row; }
    .feature-cell {
      display: table-cell;
      width: 33.33%;
      padding: 0 8px;
      text-align: center;
      vertical-align: top;
    }
    .feature-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .feature-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .feature-desc {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-card">

    <!-- Header -->
    <div class="email-header">
      <div class="brand-name">Luxora</div>
      <div class="brand-tagline">Premium Lifestyle &amp; Fashion</div>
    </div>

    <!-- Body -->
    <div class="email-body">
      <div class="hero-icon">✨</div>
      <h1 class="greeting">Welcome, ${name}!</h1>
      <p class="paragraph">
        We're absolutely thrilled to have you as part of the Luxora family.
        Your account has been created and verified — you're all set to explore
        our curated collection of premium products.
      </p>

      <hr class="divider">

      <!-- Features -->
      <div class="features-grid">
        <div class="feature-row">
          <div class="feature-cell">
            <div class="feature-icon">🛍️</div>
            <div class="feature-title">Shop Premium</div>
            <div class="feature-desc">Discover thousands of curated luxury items</div>
          </div>
          <div class="feature-cell">
            <div class="feature-icon">🚚</div>
            <div class="feature-title">Fast Delivery</div>
            <div class="feature-desc">Swift and secure delivery to your doorstep</div>
          </div>
          <div class="feature-cell">
            <div class="feature-icon">🔒</div>
            <div class="feature-title">Safe &amp; Secure</div>
            <div class="feature-desc">End-to-end encrypted payments</div>
          </div>
        </div>
      </div>

      <hr class="divider">

      <p class="paragraph">
        Ready to start your luxury journey? Click below to explore our latest collections.
      </p>

      <div class="cta-wrapper">
        <a href="${shopUrl}" class="cta-btn">Explore Luxora →</a>
      </div>

      <p class="paragraph" style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
        If you have any questions, our support team is always here to help.
      </p>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <div class="footer-links" style="margin-bottom: 10px;">
        <a href="${shopUrl}">Shop</a>
        <a href="${shopUrl}/orders">My Orders</a>
        <a href="${shopUrl}/support">Support</a>
      </div>
      <p class="footer-text">
        © ${new Date().getFullYear()} Luxora. All rights reserved.<br>
        You're receiving this email because you just created a Luxora account.<br>
        This is an automated email — please do not reply directly.
      </p>
    </div>

  </div>
</div>
</body>
</html>`;

  const text = `Welcome to Luxora, ${name}!

We're thrilled to have you as part of the Luxora family. Your account has been created and verified — you're all set.

✨ What you can do now:
- Shop premium curated products
- Track your orders in real time
- Enjoy fast and secure delivery

Start shopping: ${shopUrl}

Thank you for choosing Luxora.
© ${new Date().getFullYear()} Luxora. All rights reserved.`;

  return { html, text };
}

// ============================================================
// 2. EMAIL VERIFICATION OTP
// ============================================================
function verificationOtpTemplate(ctx: Record<string, unknown>): { html: string; text: string } {
  const name = str(ctx, 'name', 'there');
  const otp = str(ctx, 'otp', '------');
  const expiry = num(ctx, 'expiryMinutes', 5);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Verify Your Email — Luxora</title>
  <style>
    ${BASE_CSS}
    ${OTP_BOX_CSS}
    ${ALERT_CSS}
    .steps { margin: 24px 0; }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }
    .step-num {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .step-text {
      font-size: 14px;
      color: #475569;
      padding-top: 4px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-card">

    <!-- Header -->
    <div class="email-header">
      <div class="brand-name">Luxora</div>
      <div class="brand-tagline">Premium Lifestyle &amp; Fashion</div>
    </div>

    <!-- Body -->
    <div class="email-body">
      <h1 class="greeting">Verify Your Email</h1>
      <p class="paragraph">
        Hello <strong>${name}</strong>, welcome to Luxora! To complete your registration
        and secure your account, please use the one-time verification code below.
      </p>

      <!-- OTP Box -->
      <div class="otp-container">
        <div class="otp-label">Your Verification Code</div>
        <div class="otp-digits">${otp}</div>
        <div class="otp-expiry">Expires in <span>${expiry} minutes</span></div>
      </div>

      <!-- Steps -->
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text">Go back to the Luxora verification page.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text">Enter the 6-digit code shown above exactly as it appears.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text">Your account will be instantly activated — enjoy shopping!</div>
        </div>
      </div>

      <!-- Warning -->
      <div class="alert alert-warning">
        <strong>⚠️ Security Notice:</strong> This code is valid for <strong>${expiry} minutes</strong>
        only and can be used once. Never share this code with anyone —
        Luxora staff will never ask for your verification code.
      </div>

      <p class="paragraph" style="font-size: 13px; color: #94a3b8;">
        Didn't create a Luxora account? You can safely ignore this email.
        No action is needed on your part.
      </p>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p class="footer-text">
        © ${new Date().getFullYear()} Luxora. All rights reserved.<br>
        This is an automated security email — please do not reply.
      </p>
    </div>

  </div>
</div>
</body>
</html>`;

  const text = `Luxora — Verify Your Email

Hello ${name},

Your email verification code is:

  ${otp}

This code expires in ${expiry} minutes and can only be used once.

Steps to verify:
1. Return to the Luxora verification page
2. Enter the 6-digit code above
3. Your account will be instantly activated

Security Notice: Never share this code with anyone. Luxora staff will never ask for it.

Didn't create a Luxora account? Ignore this email — no action is needed.

© ${new Date().getFullYear()} Luxora. All rights reserved.`;

  return { html, text };
}

// ============================================================
// 3. PASSWORD RESET OTP
// ============================================================
function passwordResetOtpTemplate(ctx: Record<string, unknown>): { html: string; text: string } {
  const name = str(ctx, 'name', 'there');
  const otp = str(ctx, 'otp', '------');
  const expiry = num(ctx, 'expiryMinutes', 5);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reset Your Password — Luxora</title>
  <style>
    ${BASE_CSS}
    ${OTP_BOX_CSS}
    ${ALERT_CSS}
    .otp-container { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); }
    .otp-expiry span { color: #fbbf24; }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-card">

    <!-- Header -->
    <div class="email-header">
      <div class="brand-name">Luxora</div>
      <div class="brand-tagline">Premium Lifestyle &amp; Fashion</div>
    </div>

    <!-- Body -->
    <div class="email-body">
      <h1 class="greeting">Password Reset Request</h1>
      <p class="paragraph">
        Hello <strong>${name}</strong>, we received a request to reset the password
        for your Luxora account. Use the code below to proceed with resetting your password.
      </p>

      <!-- OTP Box -->
      <div class="otp-container">
        <div class="otp-label">Password Reset Code</div>
        <div class="otp-digits">${otp}</div>
        <div class="otp-expiry">Expires in <span>${expiry} minutes</span></div>
      </div>

      <!-- Danger Notice -->
      <div class="alert alert-danger">
        <strong>🔒 Didn't request this?</strong> If you didn't ask to reset your password,
        your account may be at risk. Please ignore this email and consider changing your
        password immediately or contact our support team.
      </div>

      <p class="paragraph" style="font-size: 13px; color: #94a3b8;">
        For your security, this code will expire in <strong>${expiry} minutes</strong>.
        Luxora staff will never ask you for your reset code — keep it private.
      </p>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p class="footer-text">
        © ${new Date().getFullYear()} Luxora. All rights reserved.<br>
        This is an automated security email — please do not reply.
      </p>
    </div>

  </div>
</div>
</body>
</html>`;

  const text = `Luxora — Password Reset

Hello ${name},

Your password reset code is:

  ${otp}

This code expires in ${expiry} minutes.

If you didn't request a password reset, please ignore this email.
For account security concerns, contact support immediately.

© ${new Date().getFullYear()} Luxora. All rights reserved.`;

  return { html, text };
}

// ============================================================
// 4. ORDER CONFIRMATION
// ============================================================
function orderConfirmationTemplate(ctx: Record<string, unknown>): { html: string; text: string } {
  const name = str(ctx, 'name', 'Valued Customer');
  const orderNumber = str(ctx, 'orderNumber', 'N/A');
  const orderId = str(ctx, 'orderId', '');
  const trackUrl = str(ctx, 'trackUrl', '');
  const currency = str(ctx, 'currency', 'USD');

  const subtotal = num(ctx, 'subtotal', 0);
  const taxTotal = num(ctx, 'taxTotal', 0);
  const shippingTotal = num(ctx, 'shippingTotal', 0);
  const discountTotal = num(ctx, 'discountTotal', 0);
  const grandTotal = num(ctx, 'grandTotal', 0);
  const placedAt = str(ctx, 'placedAt', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  const couponCode = str(ctx, 'couponCode', '');

  // Build order items rows
  const rawItems = ctx['items'];
  let itemRows = '';
  let itemsText = '';
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    for (const item of rawItems as Record<string, unknown>[]) {
      const itemName = str(item, 'productName', 'Product');
      const variant = str(item, 'variantName', '');
      const qty = num(item, 'quantity', 1);
      const unitPrice = num(item, 'unitPrice', 0);
      const totalPrice = num(item, 'totalPrice', 0);
      const imageUrl = str(item, 'imageUrl', '');

      itemRows += `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%">
              <tr>
                ${imageUrl ? `
                <td style="width: 64px; vertical-align: top; padding-right: 16px;">
                  <img src="${imageUrl}" alt="${itemName}" width="64" height="64"
                    style="width:64px;height:64px;border-radius:8px;object-fit:cover;display:block;">
                </td>` : ''}
                <td style="vertical-align: top;">
                  <div style="font-size:14px;font-weight:600;color:#1e293b;">${itemName}</div>
                  ${variant ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${variant}</div>` : ''}
                  <div style="font-size:13px;color:#64748b;margin-top:4px;">Qty: ${qty} × ${formatCurrency(unitPrice, currency)}</div>
                </td>
                <td style="vertical-align: top; text-align: right; white-space: nowrap;">
                  <div style="font-size:14px;font-weight:600;color:#1e293b;">${formatCurrency(totalPrice, currency)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
      itemsText += `  - ${itemName}${variant ? ` (${variant})` : ''}: ${qty} × ${formatCurrency(unitPrice, currency)} = ${formatCurrency(totalPrice, currency)}\n`;
    }
  }

  const shippingAddrHtml = formatAddress(ctx);
  const shippingAddrText = formatAddressText(ctx);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Order Confirmed — Luxora #${orderNumber}</title>
  <style>
    ${BASE_CSS}
    ${BTN_CSS}
    ${ALERT_CSS}
    .order-badge {
      display: inline-block;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
    }
    .order-meta {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .order-meta-grid {
      display: table;
      width: 100%;
    }
    .order-meta-row { display: table-row; }
    .order-meta-cell {
      display: table-cell;
      width: 50%;
      padding: 6px 0;
      vertical-align: top;
    }
    .meta-label {
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 500;
      margin-bottom: 2px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .items-table { width: 100%; border-collapse: collapse; }
    .summary-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .summary-row td { padding: 8px 0; font-size: 14px; color: #475569; }
    .summary-row.total td { padding-top: 14px; border-top: 2px solid #1e293b; font-size: 16px; font-weight: 700; color: #0f172a; }
    .summary-row.discount td { color: #22c55e; }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 14px;
      margin-top: 28px;
    }
    .address-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      font-size: 14px;
      color: #475569;
      line-height: 1.7;
    }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-card">

    <!-- Header -->
    <div class="email-header">
      <div class="brand-name">Luxora</div>
      <div class="brand-tagline">Premium Lifestyle &amp; Fashion</div>
    </div>

    <!-- Body -->
    <div class="email-body">
      <div class="order-badge">✓ Order Confirmed</div>
      <h1 class="greeting">Thank you, ${name}!</h1>
      <p class="paragraph">
        Your order has been placed and confirmed. We're already preparing your items
        for dispatch. You'll receive another update once your order ships.
      </p>

      <!-- Order Meta -->
      <div class="order-meta">
        <div class="order-meta-grid">
          <div class="order-meta-row">
            <div class="order-meta-cell">
              <div class="meta-label">Order Number</div>
              <div class="meta-value">#${orderNumber}</div>
            </div>
            <div class="order-meta-cell">
              <div class="meta-label">Order Date</div>
              <div class="meta-value">${placedAt}</div>
            </div>
          </div>
          ${orderId ? `
          <div class="order-meta-row">
            <div class="order-meta-cell" colspan="2" style="padding-top: 14px;">
              <div class="meta-label">Order ID</div>
              <div class="meta-value" style="font-size:12px;word-break:break-all;">${orderId}</div>
            </div>
          </div>` : ''}
        </div>
      </div>

      ${trackUrl ? `
      <div class="cta-wrapper">
        <a href="${trackUrl}" class="cta-btn">Track My Order →</a>
      </div>` : ''}

      <hr class="divider">

      <!-- Items -->
      ${itemRows ? `
      <div class="section-title">Order Items</div>
      <table class="items-table">
        <tbody>${itemRows}</tbody>
      </table>` : ''}

      <!-- Summary -->
      <table class="summary-table">
        <tbody>
          <tr class="summary-row">
            <td>Subtotal</td>
            <td style="text-align:right">${formatCurrency(subtotal, currency)}</td>
          </tr>
          ${discountTotal > 0 ? `
          <tr class="summary-row discount">
            <td>Discount${couponCode ? ` (${couponCode})` : ''}</td>
            <td style="text-align:right">−${formatCurrency(discountTotal, currency)}</td>
          </tr>` : ''}
          <tr class="summary-row">
            <td>Shipping</td>
            <td style="text-align:right">${shippingTotal === 0 ? '<span style="color:#22c55e;font-weight:600;">FREE</span>' : formatCurrency(shippingTotal, currency)}</td>
          </tr>
          <tr class="summary-row">
            <td>Tax</td>
            <td style="text-align:right">${formatCurrency(taxTotal, currency)}</td>
          </tr>
          <tr class="summary-row total">
            <td>Total</td>
            <td style="text-align:right">${formatCurrency(grandTotal, currency)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Shipping Address -->
      ${shippingAddrHtml ? `
      <div class="section-title">Shipping Address</div>
      <div class="address-box">${shippingAddrHtml}</div>` : ''}

      <hr class="divider">

      <!-- Success Notice -->
      <div class="alert alert-success">
        <strong>📦 What's next?</strong> Our team is processing your order.
        You'll receive an email with your tracking number once it ships — usually within 1–2 business days.
      </div>

      <p class="paragraph" style="font-size: 13px; color: #94a3b8; margin-top: 20px;">
        Need help with your order? Reply to this email or visit our
        <a href="#" style="color: #64748b;">Help Center</a>.
      </p>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p class="footer-text">
        © ${new Date().getFullYear()} Luxora. All rights reserved.<br>
        You received this email because you placed an order at Luxora.<br>
        This is a transactional email — please do not reply directly.
      </p>
    </div>

  </div>
</div>
</body>
</html>`;

  const text = `Luxora — Order Confirmed ✓

Thank you, ${name}! Your order has been placed successfully.

ORDER DETAILS
─────────────
Order Number: #${orderNumber}
${orderId ? `Order ID:     ${orderId}\n` : ''}Order Date:   ${placedAt}
${trackUrl ? `Track Order:  ${trackUrl}\n` : ''}

ITEMS ORDERED
─────────────
${itemsText || 'See order details in your account.\n'}

ORDER SUMMARY
─────────────
Subtotal:   ${formatCurrency(subtotal, currency)}
${discountTotal > 0 ? `Discount:   -${formatCurrency(discountTotal, currency)}\n` : ''}Shipping:   ${shippingTotal === 0 ? 'FREE' : formatCurrency(shippingTotal, currency)}
Tax:        ${formatCurrency(taxTotal, currency)}
Total:      ${formatCurrency(grandTotal, currency)}

${shippingAddrText ? `SHIPPING TO\n───────────\n${shippingAddrText}\n\n` : ''}
What's next? Our team is processing your order and will send you a tracking number once it ships.

Questions? Contact our support team.

© ${new Date().getFullYear()} Luxora. All rights reserved.`;

  return { html, text };
}

// ============================================================
// 5. PASSWORD CHANGED NOTIFICATION
// ============================================================
function passwordChangedTemplate(ctx: Record<string, unknown>): { html: string; text: string } {
  const name = str(ctx, 'name', 'there');
  const changedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Password Changed — Luxora</title>
  <style>
    ${BASE_CSS}
    ${ALERT_CSS}
    .success-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      border-radius: 50%;
      margin: 0 auto 20px;
      text-align: center;
      line-height: 64px;
      font-size: 28px;
    }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-card">
    <div class="email-header">
      <div class="brand-name">Luxora</div>
      <div class="brand-tagline">Premium Lifestyle &amp; Fashion</div>
    </div>
    <div class="email-body">
      <div class="success-icon">🔐</div>
      <h1 class="greeting">Password Changed</h1>
      <p class="paragraph">
        Hello <strong>${name}</strong>, this email confirms that your Luxora account
        password was successfully changed on <strong>${changedAt}</strong>.
      </p>
      <div class="alert alert-danger">
        <strong>⚠️ Wasn't you?</strong> If you did not change your password,
        your account may be compromised. Please contact our support team immediately
        and reset your password from another trusted device.
      </div>
      <p class="paragraph" style="font-size:13px;color:#94a3b8;">
        For your security, you may be logged out of all active sessions.
        Please log in again with your new password.
      </p>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        © ${new Date().getFullYear()} Luxora. All rights reserved.<br>
        This is an automated security notification — please do not reply.
      </p>
    </div>
  </div>
</div>
</body>
</html>`;

  const text = `Luxora — Password Changed

Hello ${name},

Your Luxora account password was successfully changed on ${changedAt}.

If you did NOT make this change, your account may be compromised.
Please contact support immediately and reset your password.

© ${new Date().getFullYear()} Luxora. All rights reserved.`;

  return { html, text };
}

function orderDeliveredReviewTemplate(ctx: Record<string, unknown>): { html: string; text: string } {
  const name = str(ctx, 'name', 'Valued Customer');
  const orderNumber = str(ctx, 'orderNumber', '');
  const items = (ctx.items as any[]) || [];

  const itemsHtml = items
    .map((item) => {
      const pName = escapeHtml(item.productName || 'Product');
      const vName = item.variantName ? escapeHtml(item.variantName) : '';
      const img = item.imageUrl
        ? `<img src="${item.imageUrl}" width="50" height="50" style="border-radius: 8px; object-fit: cover; margin-right: 12px;" />`
        : '';
      const reviewUrl = item.reviewUrl || '#';

      return `
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 14px 0; vertical-align: middle;">
            <div style="display: flex; align-items: center;">
              ${img}
              <div>
                <div style="font-weight: 700; font-size: 14px; color: #111111;">${pName}</div>
                ${vName ? `<div style="font-size: 12px; color: #777777; margin-top: 2px;">${vName}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="padding: 14px 0; text-align: right; vertical-align: middle;">
            <a href="${reviewUrl}" style="background-color: #ef4764; color: #ffffff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
              Write Review &rarr;
            </a>
          </td>
        </tr>
      `;
    })
    .join('');

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; color: #111111; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
        Order Delivered! 🎉
      </h2>
      <p style="font-size: 14px; color: #555555; margin: 0;">
        Hi <strong>${escapeHtml(name)}</strong>, your order <strong>#${escapeHtml(orderNumber)}</strong> has been successfully delivered.
      </p>
    </div>

    <div style="background-color: #fcfcfc; border: 1px solid #eeeeee; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
      <p style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #111111; letter-spacing: 1px; margin-top: 0; margin-bottom: 8px;">
        We'd love your feedback!
      </p>
      <p style="font-size: 13px; color: #666666; margin-bottom: 20px; line-height: 1.5;">
        Please take a moment to leave a review for your purchased products. Click on the button next to each item below to submit your rating and review:
      </p>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
      </table>
    </div>
  `;

  const html = baseTemplate({
    title: 'Your Order Has Been Delivered — Leave a Review',
    preheader: `Order #${orderNumber} delivered. Share your review!`,
    content,
  });

  const text = `Hi ${name},\n\nYour order #${orderNumber} has been delivered!\n\nPlease leave a review for your items:\n` +
    items.map((i) => `- ${i.productName}: ${i.reviewUrl}`).join('\n');

  return { html, text };
}

// ============================================================
// Template Registry Map
// ============================================================
const templates: Record<EmailTemplate, TemplateRenderer> = {
  [EmailTemplate.WELCOME]: welcomeTemplate,
  [EmailTemplate.VERIFICATION_OTP]: verificationOtpTemplate,
  [EmailTemplate.PASSWORD_RESET_OTP]: passwordResetOtpTemplate,
  [EmailTemplate.ORDER_CONFIRMATION]: orderConfirmationTemplate,
  [EmailTemplate.PASSWORD_CHANGED]: passwordChangedTemplate,
  [EmailTemplate.ORDER_DELIVERED_REVIEW]: orderDeliveredReviewTemplate,
};

function formatAddressField(address: Mail.Address): string {
  return address.address;
}

function formatRecipients(recipients: Mail.Options['to']): string {
  if (!recipients) return 'unknown';
  if (typeof recipients === 'string') return recipients;
  if (Array.isArray(recipients))
    return recipients
      .map((r) => (typeof r === 'string' ? r : formatAddressField(r)))
      .join(', ');
  return formatAddressField(recipients);
}

// ============================================================
// Mail Service
// ============================================================

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

    if (!secure && port === 587) {
      (config as any).requireTLS = true;
      (config as any).tls = { rejectUnauthorized: false };
    }

    this.transporter = nodemailer.createTransport(config);
    this.transporter.on('idle', () => this.logger.debug('SMTP connection idle'));
    this.transporter.on('error', (err) =>
      this.logger.error('SMTP connection error', err),
    );
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('✉️  SMTP connection established successfully');
    } catch (error) {
      this.logger.error('Failed to establish SMTP connection', error);
      throw error;
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const { to, subject, template, context, attachments, cc, bcc } = options;

    const templateRenderer = templates[template];
    if (!templateRenderer) throw new Error(`Template "${template}" not found`);

    const { html, text } = templateRenderer(context);

    const mailOptions: Mail.Options = {
      from: `"Luxora" <${this.configService.getOrThrow<string>('MAIL_FROM')}>`,
      to,
      cc,
      bcc,
      subject,
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
      this.logger.log(`✉️  Email sent to ${formatRecipients(mailOptions.to)}`);
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
      subject: 'Verify Your Email Address — Luxora',
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
      subject: 'Reset Your Password — Luxora',
      template: EmailTemplate.PASSWORD_RESET_OTP,
      context: {
        name: name || email.split('@')[0],
        otp,
        expiryMinutes: 5,
      },
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const shopUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://luxora.com';
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Luxora — Your Premium Fashion Destination',
      template: EmailTemplate.WELCOME,
      context: { name, shopUrl },
    });
  }

  async sendOrderConfirmation(
    email: string,
    orderNumber: string,
    name: string,
    orderId: string,
    orderDetails?: {
      items?: Array<{
        productName: string;
        variantName?: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        imageUrl?: string | null;
      }>;
      subtotal?: number;
      taxTotal?: number;
      shippingTotal?: number;
      discountTotal?: number;
      grandTotal?: number;
      currency?: string;
      couponCode?: string | null;
      placedAt?: Date;
      shippingAddress?: {
        name?: string;
        phone?: string;
        addressLine1?: string;
        addressLine2?: string | null;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      } | null;
    },
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')?.trim();
    const trackUrl = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}/orders/track?orderId=${encodeURIComponent(orderId)}`
      : undefined;

    const placedDate = orderDetails?.placedAt
      ? new Date(orderDetails.placedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

    await this.sendEmail({
      to: email,
      subject: `Order Confirmed — #${orderNumber} | Luxora`,
      template: EmailTemplate.ORDER_CONFIRMATION,
      context: {
        name,
        orderNumber,
        orderId,
        trackUrl,
        currency: orderDetails?.currency ?? 'USD',
        subtotal: orderDetails?.subtotal ?? 0,
        taxTotal: orderDetails?.taxTotal ?? 0,
        shippingTotal: orderDetails?.shippingTotal ?? 0,
        discountTotal: orderDetails?.discountTotal ?? 0,
        grandTotal: orderDetails?.grandTotal ?? 0,
        couponCode: orderDetails?.couponCode ?? '',
        placedAt: placedDate,
        items: orderDetails?.items ?? [],
        shippingAddress: orderDetails?.shippingAddress ?? null,
      },
    });
  }

  async sendPasswordChangedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Luxora Password Was Changed',
      template: EmailTemplate.PASSWORD_CHANGED,
      context: { name },
    });
  }

  async sendOrderDeliveredReviewNotification(
    email: string,
    orderNumber: string,
    name: string,
    items: Array<{
      productName: string;
      variantName?: string;
      imageUrl?: string | null;
      productSlugOrId: string;
    }>,
  ): Promise<void> {
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    )
      .trim()
      .replace(/\/$/, '');

    const formattedItems = items.map((item) => ({
      ...item,
      reviewUrl: `${frontendUrl}/product/${encodeURIComponent(item.productSlugOrId)}`,
    }));

    await this.sendEmail({
      to: email,
      subject: `Order Delivered — Leave a Review for Your Items | #${orderNumber}`,
      template: EmailTemplate.ORDER_DELIVERED_REVIEW,
      context: {
        name,
        orderNumber,
        items: formattedItems,
      },
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
