import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, PATCH } from '@/app/api/v1/account/route'

const { getSession, updateUser } = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/auth/auth', () => ({ auth: { api: { updateUser } } }))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

afterEach(() => vi.clearAllMocks())

const user = {
  id: 'user-1',
  name: 'Jamie',
  email: 'jamie@example.test',
  locale: 'en-US',
}

describe('account routes', () => {
  it('requires authentication before returning profile data', async () => {
    getSession.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('returns only the signed-in user profile with a safe locale fallback', async () => {
    getSession.mockResolvedValue({ user: { ...user, locale: 'unknown' } })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      account: { ...user, locale: 'en-US' },
    })
  })

  it('rejects malformed profile data without calling Better Auth', async () => {
    getSession.mockResolvedValue({ user })

    const response = await PATCH(
      new Request('http://localhost/api/v1/account', {
        method: 'PATCH',
        body: JSON.stringify({ name: ' ', locale: 'en-US', role: 'admin' }),
      }),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('sanitizes and persists the signed-in user profile', async () => {
    getSession.mockResolvedValueOnce({ user }).mockResolvedValueOnce({
      user: { ...user, name: 'Jamie Lee', locale: 'de-DE' },
    })
    updateUser.mockResolvedValue({ status: true })

    const response = await PATCH(
      new Request('http://localhost/api/v1/account', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  Jamie\u0000 Lee  ', locale: 'de-DE' }),
      }),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).account).toEqual({
      id: user.id,
      name: 'Jamie Lee',
      email: user.email,
      locale: 'de-DE',
    })
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { name: 'Jamie Lee', locale: 'de-DE' },
      }),
    )
  })
})
