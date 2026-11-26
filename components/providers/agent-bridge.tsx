'use client'

import { useEffect } from 'react'
import type { AgentAction } from '@ui-sdk/react/agent'
import { allowDiscoveryAction } from '@/lib/ui-agent-policy'

const allow = (step: AgentAction) =>
  allowDiscoveryAction(step, window.location.pathname)

export function AgentBridge() {
  useEffect(() => {
    if (!('modelContext' in document)) return
    const lifecycle = new AbortController()
    void import('@ui-sdk/react/agent').then(
      ({ createAgent, registerTools }) => {
        if (lifecycle.signal.aborted) return
        const unregister = registerTools(createAgent({ allow }), { allow })
        lifecycle.signal.addEventListener('abort', unregister, { once: true })
      },
    )
    return () => lifecycle.abort()
  }, [])
  return null
}
