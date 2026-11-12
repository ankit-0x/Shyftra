// server/src/utils/mailer.js
import nodemailer from "nodemailer";

import { logError } from "./logger.js";
let transporterPromise = null;

async function buildTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465, // 465 = implicit TLS
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SMTP_HOST is not set — cannot send email in production");
  }
  // Dev fallback: Ethereal fake inbox. Nothing is delivered; we log a preview URL.
  const account = await nodemailer.createTestAccount();
  console.log("📧 Using Ethereal test inbox:", account.user);
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
}

function getTransporter() {
  transporterPromise ??= buildTransporter().catch((err) => {
    transporterPromise = null; // allow retry next call
    throw err;
  });
  return transporterPromise;
}

export async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Shyftra" <no-reply@shyftra.local>',
    to,
    subject,
    html,
    text,
  });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("📧 Email preview:", preview); // dev only
  return info;
}

// Fire-and-forget wrapper: never throws, never delays the HTTP response.
export function sendMailSafely(opts) {
  sendMail(opts).catch((err) => logError("sendMail failed:", err));
}
