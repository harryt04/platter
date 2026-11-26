import { act, cleanup, render, screen } from '@testing-library/react'
import { createAgent } from '@ui-sdk/react/agent'
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { Input } from '@/components/ui/input'
import { allowDiscoveryAction } from '@/lib/ui-agent-policy'

afterEach(cleanup)

it('applies agent edits to React state and redacts the other field', async () => {
  const agent = createAgent({
    allow: (step) => allowDiscoveryAction(step, '/discover'),
  })
  function Fields() {
    const [value, setValue] = useState('')
    return (
      <>
        <Input
          aria-label="Search recipes"
          agentReadable
          value={value}
          onValueChange={setValue}
        />
        <output>{value}</output>
        <Input aria-label="Contact" defaultValue="synthetic@example.test" />
      </>
    )
  }
  render(<Fields />)
  expect(agent.snapshot()).toContainEqual(
    expect.objectContaining({ label: 'Contact', value: '[redacted]' }),
  )
  await act(async () => {
    await agent.act({
      steps: [
        { ref: 'Search recipes', action: 'setValue', args: ['radishes'] },
      ],
    })
  })
  expect(screen.getByRole('status')).toHaveTextContent('radishes')
})
