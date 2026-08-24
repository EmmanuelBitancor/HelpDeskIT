import nodemailer from "nodemailer";

const customHost = process.env.SMTP_HOST;
const customPort = Number(process.env.SMTP_PORT || "587");
const customUser = process.env.SMTP_USER;
const customPass = process.env.SMTP_PASS;
const customFrom = process.env.SMTP_FROM || customUser || "no-reply@example.com";
const isDevelopment = process.env.NODE_ENV !== "production";

let cachedTransporter: {
  transporter: nodemailer.Transporter | null;
  from: string;
  testAccount?: { user: string; pass: string };
} | null = null;

async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (customHost && customUser && customPass) {
    const transporter = nodemailer.createTransport({
      host: customHost,
      port: customPort,
      secure: customPort === 465,
      requireTLS: customPort !== 465,
      auth: { user: customUser, pass: customPass },
    });
    cachedTransporter = { transporter, from: customFrom };
    return cachedTransporter;
  }

  if (!isDevelopment) {
    cachedTransporter = { transporter: null, from: customFrom };
    return cachedTransporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  const from = `HelpDeskIT <${testAccount.user}>`;
  cachedTransporter = { transporter, from, testAccount };
  return cachedTransporter;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const { transporter, from, testAccount } = await getTransporter();

    if (!transporter) {
      console.warn("[email] No SMTP configured and Ethereal setup failed. Email not sent.");
      return;
    }

    const info = await transporter.sendMail({ from, to, subject, html });

    if (testAccount) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[email] Preview URL: ${previewUrl}`);
      }
    }
  } catch (error) {
    console.error("[email] Delivery failed", error instanceof Error ? error.message : error);
  }
}

export function isEmailConfigured() {
  return !!(customHost && customUser && customPass);
}
