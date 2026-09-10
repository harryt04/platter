import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueRecipeImport } from '@/lib/jobs/queue'

const { Agenda, MongoBackend, job } = vi.hoisted(() => ({
  Agenda: vi.fn(),
  MongoBackend: vi.fn(),
  job: {
    unique: vi.fn(),
    schedule: vi.fn(),
    save: vi.fn(),
  },
}))

vi.mock('agenda', () => ({ Agenda }))
vi.mock('@agendajs/mongo-backend', () => ({ MongoBackend }))

beforeEach(() => {
  vi.clearAllMocks()
  job.unique.mockReturnValue(job)
  job.schedule.mockReturnValue(job)
  job.save.mockResolvedValue(undefined)
  Agenda.mockImplementation(() => ({
    create: vi.fn().mockReturnValue(job),
  }))
})

describe('enqueueRecipeImport', () => {
  it('persists a minimal, uniquely keyed Agenda job', async () => {
    const db = {} as never
    const payload = {
      importId: 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
      userId: 'user-1',
      idempotencyKey: 'import-key-1',
    }

    await enqueueRecipeImport(db, payload)

    const agenda = Agenda.mock.results[0]?.value
    expect(MongoBackend).toHaveBeenCalledWith({ mongo: db })
    expect(Agenda).toHaveBeenCalledWith({
      backend: expect.anything(),
      name: 'platter-web-enqueuer',
    })
    expect(agenda.create).toHaveBeenCalledWith('recipe-import', payload)
    expect(job.unique).toHaveBeenCalledWith(
      {
        'data.userId': payload.userId,
        'data.idempotencyKey': payload.idempotencyKey,
      },
      { insertOnly: true },
    )
    expect(job.schedule).toHaveBeenCalledWith(expect.any(Date))
    expect(job.save).toHaveBeenCalledOnce()
  })
})
