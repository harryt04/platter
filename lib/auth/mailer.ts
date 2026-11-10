import nodemailer from 'nodemailer'
import { serverEnv } from '@/lib/env/server'

export async function sendPasswordResetEmail(to: string, url: string) {
  const env = serverEnv()
  if (!env.SMTP_ENABLED) return

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  })
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your Platter password',
    text: `Reset your password with this link: ${url}`,
  })
}

export async function sendInvitationEmail(
  to: string,
  url: string,
  listName: string,
) {
  const env = serverEnv()
  if (!env.SMTP_ENABLED) return

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  })
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Invitation to collaborate on ${listName}`,
    text: `You’ve been invited to collaborate on ${listName} in Platter.\n\nOpen this invitation to join: ${url}`,
  })
}
