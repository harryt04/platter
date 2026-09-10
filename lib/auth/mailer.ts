import nodemailer from 'nodemailer'
import { serverEnv } from '@/lib/env/server'

export async function sendPasswordResetEmail(to: string, url: string) {
  const env = serverEnv()
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
