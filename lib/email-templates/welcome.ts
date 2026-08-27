import { getBaseHtml, getBaseText } from "./base";

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
