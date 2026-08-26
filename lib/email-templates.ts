export function getBaseHtml(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    /* Reset */
    body { margin: 0; padding: 0; }
    table { border-collapse: collapse; }

    /* Base */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f0f4f8;
      color: #1a202c;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* Layout */
    .wrapper {
      width: 100%;
      padding: 32px 16px;
      background-color: #f0f4f8;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      padding: 36px 40px;
      text-align: center;
      position: relative;
    }
    .header-logo {
      display: inline-block;
      width: 48px;
      height: 48px;
      background-color: rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      line-height: 48px;
      font-size: 24px;
      margin-bottom: 12px;
      backdrop-filter: blur(4px);
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 400;
    }

    /* Icon Banner */
    .icon-banner {
      text-align: center;
      padding: 32px 40px 20px;
    }
    .icon-circle {
      display: inline-block;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      line-height: 64px;
      font-size: 28px;
    }

    /* Content */
    .content {
      padding: 0 40px 36px;
      color: #4a5568;
      font-size: 15px;
    }
    .content h2 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 700;
      color: #1a202c;
      text-align: center;
    }
    .content p {
      margin: 0 0 16px;
    }
    .content strong {
      color: #1a202c;
      font-weight: 600;
    }

    /* Info Box */
    .info-box {
      background-color: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .info-box .label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #718096;
      margin-bottom: 4px;
    }
    .info-box .value {
      font-size: 15px;
      font-weight: 500;
      color: #1a202c;
      word-break: break-all;
    }

    /* Code Box */
    .code-box {
      background-color: #1e3a5f;
      border-radius: 10px;
      padding: 20px 24px;
      text-align: center;
      margin: 24px 0;
      position: relative;
    }
    .code-box .code-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 10px;
    }
    .code-box .code-value {
      font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 8px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    /* Button */
    .button-wrapper {
      text-align: center;
      margin: 28px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: 0.2px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3), 0 2px 4px rgba(37, 99, 235, 0.15);
    }

    /* Divider */
    .divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 28px 0;
    }

    /* Warning Banner */
    .warning-box {
      background-color: #fffaf0;
      border: 1px solid #fbd38d;
      border-left: 4px solid #ed8936;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 20px 0;
      font-size: 14px;
      color: #744210;
    }

    /* Footer */
    .footer {
      padding: 24px 40px;
      text-align: center;
      background-color: #f7fafc;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #a0aec0;
      line-height: 1.5;
    }
    .footer .brand {
      font-weight: 600;
      color: #718096;
    }

    /* Utility */
    .text-center { text-align: center; }
    .mt-0 { margin-top: 0; }
    .mb-0 { margin-bottom: 0; }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="center">
        <div class="container">
          <div class="header">
            <div class="header-logo">🎫</div>
            <h1>HelpDeskIT</h1>
            <p>IT Support &amp; Ticket Management</p>
          </div>
          <div class="content">
            ${body}
          </div>
          <div class="footer">
            <p><span class="brand">HelpDeskIT</span> &copy; ${new Date().getFullYear()} HelpDeskIT. All rights reserved.</p>
            <p style="margin-top: 6px;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getBaseText(title: string, body: string): string {
  return `
${title}

${body}

---
HelpDeskIT
© ${new Date().getFullYear()} HelpDeskIT. All rights reserved.

This is an automated message. Please do not reply to this email.
`;
}

export function welcomeEmail({ name, email }: { name: string; email: string }): { subject: string; html: string; text: string } {
  const subject = "Welcome to HelpDeskIT";
  const body = `
    <div class="icon-banner">
      <div class="icon-circle" style="background-color: #e0e7ff; color: #4f46e5;">👋</div>
    </div>
    <h2>Welcome, ${name}!</h2>
    <p>Your account has been successfully created. We're excited to have you on board.</p>

    <div class="info-box">
      <div class="label">Account Email</div>
      <div class="value">${email}</div>
    </div>

    <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>

    <div class="button-wrapper">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}" class="button">Go to HelpDeskIT</a>
    </div>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Welcome, ${name}!

Your account has been successfully created. We're excited to have you on board.

Account Email: ${email}

If you have any questions or need assistance, feel free to reach out to our support team.

Get started: ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}`),
  };
}

export function staffWelcomeEmail({ name, email }: { name: string; email: string }): { subject: string; html: string; text: string } {
  const subject = "Welcome to the HelpDeskIT Support Team";
  const body = `
    <div class="icon-banner">
      <div class="icon-circle" style="background-color: #e0e7ff; color: #4f46e5;">🛡️</div>
    </div>
    <h2>Hello ${name},</h2>
    <p>Your support staff account has been created. You now have access to the <strong>HelpDeskIT admin dashboard</strong>.</p>

    <div class="info-box">
      <div class="label">Staff Email</div>
      <div class="value">${email}</div>
    </div>

    <p>Please sign in to start managing tickets and assisting users.</p>

    <div class="button-wrapper">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}" class="button">Go to Dashboard</a>
    </div>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Hello ${name},

Your support staff account has been created. You now have access to the HelpDeskIT admin dashboard.

Staff Email: ${email}

Please sign in to start managing tickets and assisting users.

Dashboard: ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}`),
  };
}

export function otpEmail({ otp }: { email: string; otp: string }): { subject: string; html: string; text: string } {
  const subject = "Verify your email - HelpDeskIT";
  const body = `
    <div class="icon-banner">
      <div class="icon-circle" style="background-color: #dbeafe; color: #2563eb;">✉️</div>
    </div>
    <h2>Verify your email address</h2>
    <p>Please use the following verification code to complete your signup:</p>

    <div class="code-box">
      <div class="code-label">Verification Code</div>
      <div class="code-value">${otp}</div>
    </div>

    <p style="text-align: center; font-size: 14px; color: #718096; margin-bottom: 0;">This code will expire in <strong>10 minutes</strong>.</p>
    <hr class="divider">
    <div class="warning-box">
      <strong>Didn't request this?</strong> If you did not sign up for HelpDeskIT, you can safely ignore this email.
    </div>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Verify your email - HelpDeskIT

Your verification code is: ${otp}

This code will expire in 10 minutes.

Didn't request this? If you did not sign up for HelpDeskIT, you can safely ignore this email.`),
  };
}

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
