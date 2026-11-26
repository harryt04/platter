'use client'

import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { PublicContentSuppressionTargetType } from '@/lib/public-content-suppressions'

export type PublicContentSuppressionTarget = {
  targetType: PublicContentSuppressionTargetType
  target: string
  label: string
}

type SuppressionResponse = {
  suppression?: {
    targetType: PublicContentSuppressionTargetType
    target: string
  }
  detail?: string
}

function suppressionTargetKey({
  targetType,
  target,
}: PublicContentSuppressionTarget) {
  return JSON.stringify([targetType, target])
}

export function SuppressPublicContentForm({
  targets,
  onSuppressed,
}: {
  targets: PublicContentSuppressionTarget[]
  onSuppressed: (target: PublicContentSuppressionTarget) => void
}) {
  const [targetKey, setTargetKey] = React.useState<string | null>(null)
  const [reason, setReason] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const selectedTarget =
    targets.find((target) => suppressionTargetKey(target) === targetKey) ??
    targets[0]

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTarget || !window.confirm('Suppress this public content?')) {
      return
    }
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(
        '/api/v1/admin/public-content-suppressions',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            targetType: selectedTarget.targetType,
            target: selectedTarget.target,
            reason,
          }),
        },
      )
      const body = (await response.json()) as SuppressionResponse
      if (!response.ok || !body.suppression) {
        throw new Error(body.detail ?? 'The suppression could not be recorded.')
      }
      onSuppressed(selectedTarget)
      setReason('')
      setMessage('Suppression recorded with an audit entry.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Collapsible className="border-t pt-4 sm:col-span-2">
      <CollapsibleTrigger className="min-h-11 cursor-pointer text-sm font-medium underline underline-offset-4">
        Suppress public content
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor={`suppression-target-${targets[0]?.target}`}>
              Suppress
            </Label>
            <SelectField
              disabled={pending}
              id={`suppression-target-${targets[0]?.target}`}
              items={targets.map((target) => ({
                value: suppressionTargetKey(target),
                label: target.label,
              }))}
              onValueChange={(value) => {
                if (value !== null) setTargetKey(value)
              }}
              value={
                selectedTarget ? suppressionTargetKey(selectedTarget) : null
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`suppression-reason-${targets[0]?.target}`}>
              Reason
            </Label>
            <Textarea
              aria-describedby={`suppression-help-${targets[0]?.target}`}
              disabled={pending}
              id={`suppression-reason-${targets[0]?.target}`}
              maxLength={2000}
              onValueChange={setReason}
              required
              value={reason}
            />
            <p
              className="text-muted-foreground text-xs"
              id={`suppression-help-${targets[0]?.target}`}
            >
              This reason is retained with the administrator and timestamp audit
              record.
            </p>
          </div>
          <Button
            disabled={pending || reason.trim().length === 0}
            type="submit"
          >
            {pending ? 'Recording…' : 'Record suppression'}
          </Button>
          {message && (
            <p aria-live="polite" className="text-success text-sm">
              {message}
            </p>
          )}
          {error && (
            <p aria-live="polite" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}
