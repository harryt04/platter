import { describe, expect, it } from 'vitest'
import {
  adminPrivateContentAccessRequestSchema,
  authorizeAdminPrivateContentAccess,
  isAdminPrivateContentAccessActive,
  recordAdminPrivateContentAccessAudit,
} from '@/lib/auth/admin-private-content-access'

describe('administrator private-content access policy', () => {
  const now = new Date('2026-09-11T12:00:00.000Z')
  const request = {
    targetUserId: 'user-private-1',
    purpose: 'support-case' as const,
    caseReference: 'SUP-1234',
  }

  it('denies private access unless the instance policy explicitly enables it', () => {
    expect(
      authorizeAdminPrivateContentAccess({
        actorId: 'admin-1',
        actorRole: 'admin',
        request,
        policy: { enabled: false, maxDurationMinutes: 15 },
        now,
      }),
    ).toEqual({
      allowed: false,
      code: 'PRIVATE_CONTENT_ACCESS_DISABLED',
      detail:
        'Exceptional private-content access is disabled by the instance policy.',
    })
  })

  it('requires an administrator and a valid, explicitly scoped request', () => {
    const nonAdminDecision = authorizeAdminPrivateContentAccess({
      actorId: 'user-1',
      actorRole: 'user',
      request,
      policy: { enabled: true, maxDurationMinutes: 15 },
      now,
    })
    expect(nonAdminDecision.allowed).toBe(false)
    if (nonAdminDecision.allowed) return
    expect(nonAdminDecision.code).toBe('ADMINISTRATOR_REQUIRED')
    expect(
      adminPrivateContentAccessRequestSchema.safeParse({
        ...request,
        caseReference: 'private recipe details',
      }).success,
    ).toBe(false)
    expect(
      authorizeAdminPrivateContentAccess({
        actorId: 'admin-1',
        actorRole: 'admin',
        request: { ...request, extra: 'unexpected' },
        policy: { enabled: true, maxDurationMinutes: 15 },
        now,
      }),
    ).toMatchObject({ allowed: false, code: 'INVALID_REQUEST' })
  })

  it('creates a short-lived grant and reports its expiry accurately', () => {
    const decision = authorizeAdminPrivateContentAccess({
      actorId: 'admin-1',
      actorRole: 'admin',
      request,
      policy: { enabled: true, maxDurationMinutes: 15 },
      now,
    })
    expect(decision.allowed).toBe(true)
    if (!decision.allowed) return

    expect(decision.grant).toMatchObject({
      actorId: 'admin-1',
      targetUserId: 'user-private-1',
      purpose: 'support-case',
      caseReference: 'SUP-1234',
      grantedAt: '2026-09-11T12:00:00.000Z',
      expiresAt: '2026-09-11T12:15:00.000Z',
    })
    expect(
      isAdminPrivateContentAccessActive(
        decision.grant,
        new Date('2026-09-11T12:14:59.999Z'),
      ),
    ).toBe(true)
    expect(
      isAdminPrivateContentAccessActive(
        decision.grant,
        new Date('2026-09-11T12:15:00.000Z'),
      ),
    ).toBe(false)
  })

  it('audits a grant without retaining the raw target account identifier', async () => {
    const inserted: Record<string, unknown>[] = []
    const db = {
      collection: () => ({
        insertOne: async (document: Record<string, unknown>) => {
          inserted.push(document)
        },
      }),
    } as never
    const decision = authorizeAdminPrivateContentAccess({
      actorId: 'admin-1',
      actorRole: 'admin',
      request,
      policy: { enabled: true, maxDurationMinutes: 15 },
      now,
    })
    if (!decision.allowed) throw new Error('expected a grant')

    await recordAdminPrivateContentAccessAudit(db, decision.grant, now)
    expect(inserted[0]).toMatchObject({
      action: 'access-granted',
      actorId: 'admin-1',
      purpose: 'support-case',
      caseReference: 'SUP-1234',
    })
    expect(inserted[0]).not.toHaveProperty('targetUserId')
    expect(inserted[0]?.targetUserFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })
})
