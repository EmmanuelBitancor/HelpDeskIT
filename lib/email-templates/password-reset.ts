import { getBaseHtml, getBaseText } from "./base";

export function passwordResetEmail({ token, origin }: { email: string; token: string; origin: string }): { subject: string; html: string; text: string } {
  const resetUrl = `${origin}/auth/reset-password?token=${token}`;
  const subject = "Reset your password - HelpDeskIT";
  const body = `
    <div class="icon-banner">
      <div class="icon-circle" style="background-color: #fef3c7; color: #d97706;">🔒</div>
    </div>
    <h2>Reset your password</h2>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>

    <div class="button-wrapper">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>

    <p>Or copy and paste this link into your browser:</p>
    <div class="info-box">
      <div class="value" style="font-size: 13px; font-family: monospace;">${resetUrl}</div>
    </div>

    <p style="font-size: 14px; color: #718096;">This link will expire in <strong>1 hour</strong>.</p>

    <hr class="divider">
    <div class="warning-box">
      <strong>Didn't request this?</strong> If you did not request a password reset, please ignore this email and make sure your account is secure.
    </div>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Reset your password

We received a request to reset your password. Reset your password by visiting: ${resetUrl}

This link will expire in 1 hour.

Didn't request this? If you did not request a password reset, please ignore this email and make sure your account is secure.`),
  };
}

export function passwordResetNotificationEmail({ name, email }: { name: string; email: string }): { subject: string; html: string; text: string } {
  const subject = "Password Reset Request Received";
  const body = `
    <div class="icon-banner">
      <div class="icon-circle" style="background-color: #fef3c7; color: #d97706;">🔐</div>
    </div>
    <h2>Password Reset Request</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset the password for the account associated with:</p>

    <div class="info-box">
      <div class="label">Account Email</div>
      <div class="value">${email}</div>
    </div>

    <p>If you made this request, please check your inbox for the reset link.</p>

    <hr class="divider">

    <div class="warning-box">
      <strong>Didn't request this?</strong> If you did not request a password reset, please contact support immediately to secure your account.
    </div>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Password Reset Request Received

Hello ${name},

We received a request to reset the password for the account associated with: ${email}

If you made this request, please check your inbox for the reset link.

Didn't request this? If you did not request a password reset, please contact support immediately to secure your account.`),
  };
}
