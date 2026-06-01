import nodemailer from "nodemailer";
import { prisma } from "../../db.js";

const isConfigured = !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmailToUser(
  userId: string,
  subject: string,
  htmlContent: string
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user || !user.email) return;

    if (!isConfigured) {
      console.info(`[Email Service] Sandbox mode - Email to ${user.email} (Subject: ${subject})`);
      console.debug(`[Email Content]\n${htmlContent}`);
      return;
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"ATRAIL Notifier" <noreply@atrail.com>',
      to: user.email,
      subject,
      html: htmlContent,
    });

    console.info(`Email sent to ${user.email}: ${info.messageId}`);
  } catch (err) {
    console.error(`Failed to send email to ${userId}: ${err}`);
  }
}
