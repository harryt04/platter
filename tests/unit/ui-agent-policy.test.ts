import { describe, expect, it } from 'vitest'
import { allowDiscoveryAction } from '@/lib/ui-agent-policy'

const edit = {
  ref: 'c1',
  component: 'input',
  label: 'Search recipes',
  action: 'setValue',
  args: ['soup'],
}

describe('WebMCP discovery policy', () => {
  it('allows the reviewed public GET form', () => {
    for (const label of [
      'Search recipes',
      'Filter by tags',
      'Filter by cuisine',
      'Filter by dietary labels',
    ]) {
      expect(allowDiscoveryAction({ ...edit, label }, '/discover')).toBe(true)
      expect(
        allowDiscoveryAction(
          { ...edit, label, action: 'clear', args: [] },
          '/discover',
        ),
      ).toBe(true)
    }
    expect(
      allowDiscoveryAction(
        {
          ...edit,
          component: 'button',
          label: 'Search',
          action: 'press',
          args: [],
        },
        '/discover',
      ),
    ).toBe(true)
  })

  it('denies other routes, controls, actions and confirmed steps', () => {
    for (const route of [
      '/settings',
      '/sign-in',
      '/lists',
      '/admin',
      '/discover/other',
    ])
      expect(allowDiscoveryAction(edit, route)).toBe(false)
    for (const overrides of [
      { confirm: 'Delete' },
      { confirm: '' },
      { label: 'Email' },
      { component: 'menu' },
      { action: 'press' },
      { args: [42] },
      { component: 'button', label: 'Delete', action: 'press', args: [] },
    ])
      expect(allowDiscoveryAction({ ...edit, ...overrides }, '/discover')).toBe(
        false,
      )
  })
})
