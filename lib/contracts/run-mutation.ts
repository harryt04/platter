import { problemResponse } from '@/lib/contracts/problem'

/** A stale client must never be allowed to write into the replacement run. */
export function completedRunProblem() {
  return problemResponse({
    type: 'https://platter.dev/problems/run-completed',
    title: 'Shopping run completed',
    status: 409,
    detail:
      'This shopping run was completed on another device. Refresh to use the new active run.',
    code: 'RUN_COMPLETED',
  })
}
