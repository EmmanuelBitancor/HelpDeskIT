export function getBaseHtml(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background-color: #1f2937; color: #ffffff; padding: 20px; text-align: center; }
    .content { padding: 30px; color: #333333; line-height: 1.6; }
    .button { display: inline-block; padding: 12px 24px; background-color: #1f2937; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #888888; font-size: 12px; border-top: 1px solid #eeeeee; }
    .code { background-color: #f4f4f4; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 18px; letter-spacing: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HelpDeskIT</h1>
    </div>
    <div class="content">
      ${body}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} HelpDeskIT. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

export function getBaseText(title: string, body: string): string {
  return `
${title}

${body}

---
© ${new Date().getFullYear()} HelpDeskIT. All rights reserved.
`;
}

export function welcomeEmail({ name, email }: { name: string; email: string }): { subject: string; html: string; text: string } {
  const subject = "Welcome to HelpDeskIT";
  const body = `
    <h2>Welcome, ${name}!</h2>
    <p>Your account has been successfully created. We're excited to have you on board.</p>
    <p>You can now sign in to your account using your email address:</p>
    <p><strong>${email}</strong></p>
    <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}" class="button">Go to HelpDeskIT</a>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, body),
  };
}

export function staffWelcomeEmail({ name, email }: { name: string; email: string }): { subject: string; html: string; text: string } {
  const subject = "Welcome to the HelpDeskIT Support Team";
  const body = `
    <h2>Hello ${name},</h2>
    <p>Your support staff account has been created. You now have access to the HelpDeskIT admin dashboard.</p>
    <p><strong>Email:</strong> ${email}</p>
    <p>Please sign in to start managing tickets and assisting users.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}" class="button">Go to Dashboard</a>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, body),
  };
}

export function otpEmail({ otp }: { email: string; otp: string }): { subject: string; html: string; text: string } {
  const subject = "Verify your email - HelpDeskIT";
  const body = `
    <h2>Verify your email address</h2>
    <p>Please use the following verification code to complete your signup:</p>
    <p class="code">${otp}</p>
    <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.`),
  };
}

export function passwordResetEmail({ token, origin }: { email: string; token: string; origin: string }): { subject: string; html: string; text: string } {
  const resetUrl = `${origin}/auth/reset-password?token=${token}`;
  const subject = "Reset your password - HelpDeskIT";
  const body = `
    <h2>Reset your password</h2>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p>${resetUrl}</p>
    <p>This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Reset your password by visiting: ${resetUrl}\n\nThis link will expire in 1 hour.`),
  };
}

export function passwordResetNotificationEmail({ name, email }: { name: string; email: string }): { subject: string; html: string; text: string } {
  const subject = "Password Reset Request Received";
  const body = `
    <h2>Password Reset Request</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset the password for the account associated with <strong>${email}</strong>.</p>
    <p>If you made this request, please check your inbox for the reset link. If you did not request a password reset, please contact support immediately.</p>
  `;
  return {
    subject,
    html: getBaseHtml(subject, body),
    text: getBaseText(subject, `Password reset request received for ${email}.`),
  };
}
