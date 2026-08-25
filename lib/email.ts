import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  const mailTransporter = getTransporter();

  if (!mailTransporter || !smtpFrom) {
    console.log("[Email] SMTP not configured. Would send:", { to, subject });
    return { skipped: true as const };
  }

  try {
    await mailTransporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
      text: text || subject,
    });

    return { success: true as const };
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return { success: false as const, error };
  }
}
