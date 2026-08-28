import { getBaseHtml, getBaseText } from "./base";

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
