import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ImportPage from '@/app/(app)/import/page'

const { requireSession, getConnectedDatabase } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ requireSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe('ImportPage', () => {
  it('explains that URL imports require connectivity', async () => {
    requireSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockReturnValue({
      collection: vi.fn(() => ({
        find: vi.fn(() => ({
          sort: vi.fn(() => ({
            limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
          })),
        })),
      })),
    })

    render(await ImportPage())

    expect(
      screen.getByText(/submit a public recipe URL while connected/i),
    ).toBeInTheDocument()
  })
})
