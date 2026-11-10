import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendInvitationEmail, sendPasswordResetEmail } from '@/lib/auth/mailer'

const { createTransport, serverEnv, sendMail } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  serverEnv: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: { createTransport },
}))
vi.mock('@/lib/env/server', () => ({ serverEnv }))

beforeEach(() => {
  vi.clearAllMocks()
  createTransport.mockReturnValue({ sendMail })
  serverEnv.mockReturnValue({
    SMTP_ENABLED: false,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'noreply@example.test',
    SMTP_SECURE: false,
  })
})

describe('SMTP mail delivery', () => {
  it('does not create a transporter when SMTP is disabled', async () => {
    await sendInvitationEmail(
      'guest@example.com',
      'http://localhost:3000/invitations/token',
      'Family',
    )
    await sendPasswordResetEmail(
      'guest@example.com',
      'http://localhost:3000/reset-password/token',
    )

    expect(createTransport).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('sends invitation email through the configured SMTP transport', async () => {
    serverEnv.mockReturnValue({
      SMTP_ENABLED: true,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_FROM: 'noreply@example.com',
      SMTP_SECURE: true,
      SMTP_USER: 'smtp-user',
      SMTP_PASSWORD: 'smtp-password',
    })

    await sendInvitationEmail(
      'guest@example.com',
      'https://platter.example/invitations/token',
      'Family',
    )

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: true,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
    })
    expect(sendMail).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'guest@example.com',
      subject: 'Invitation to collaborate on Family',
      text: expect.stringContaining(
        'https://platter.example/invitations/token',
      ),
    })
  })
})
