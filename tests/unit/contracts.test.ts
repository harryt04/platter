import { describe, expect, it } from 'vitest'
import { decimalString, entityId, isoDateTime } from '@/lib/contracts/ids'
import { problemSchema } from '@/lib/contracts/problem'

describe('foundation contracts', () => {
  it('keeps boundary values opaque and serializable', () => {
    expect(entityId('recipe-1')).toBe('recipe-1')
    expect(decimalString(2.5)).toBe('2.5')
    expect(isoDateTime('2026-09-10T00:00:00.000Z')).toBe(
      '2026-09-10T00:00:00.000Z',
    )
  })
  it('validates problem responses', () => {
    expect(
      problemSchema.parse({
        type: 'x',
        title: 'Nope',
        status: 400,
        detail: 'Bad input',
        code: 'BAD',
      }).code,
    ).toBe('BAD')
  })
})
