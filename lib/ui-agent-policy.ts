import type { AgentAction } from '@ui-sdk/react/agent'

const discoveryFields = new Set([
  'Search recipes',
  'Filter by cuisine',
  'Filter by tags',
  'Filter by dietary labels',
])

export function allowDiscoveryAction(step: AgentAction, pathname: string) {
  if (pathname !== '/discover' || step.confirm !== undefined) return false
  if (step.component === 'button')
    return (
      step.label === 'Search' &&
      step.action === 'press' &&
      step.args.length === 0
    )
  if (step.component !== 'input' || !discoveryFields.has(step.label ?? ''))
    return false
  return (
    (step.action === 'clear' && step.args.length === 0) ||
    (step.action === 'setValue' &&
      step.args.length === 1 &&
      typeof step.args[0] === 'string')
  )
}
