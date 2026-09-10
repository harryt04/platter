import { describe, expect, it } from 'vitest'

describe('foundation integration placeholder', () => {
  it('documents the external service boundary', () => {
    expect(
      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/?replicaSet=rs0',
    ).toContain('mongodb')
  })
})
