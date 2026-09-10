'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import type { GroceryItem } from '@/lib/recipes/groceries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function formatQuantity(
  quantity: GroceryItem['calculatedRequirement'],
  unit: GroceryItem['unit'],
) {
  if (!quantity) return 'As needed'
  const amount = quantity.max ? `${quantity.min}–${quantity.max}` : quantity.min
  return unit.name ? `${amount} ${unit.name}` : amount
}

export function GroceryAmountOverrideForm({
  item,
  listId,
  baseRevision,
  editable = true,
}: {
  item: GroceryItem
  listId: string
  baseRevision?: number
  editable?: boolean
}) {
  const router = useRouter()
  const [mutationRevision, setMutationRevision] = React.useState<number>()
  const [amount, setAmount] = React.useState(
    item.override?.min ?? item.calculatedRequirement?.min ?? '',
  )
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const currentRevision =
    mutationRevision === undefined || baseRevision === undefined
      ? (mutationRevision ?? baseRevision)
      : Math.max(mutationRevision, baseRevision)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(item.id)}/override`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            quantity: { min: amount.trim() },
            ...createMutationMetadata(currentRevision),
          }),
        },
      )
      const body = (await response.json()) as {
        detail?: string
        revision?: number
      }
      if (!response.ok) {
        throw new Error(body.detail ?? 'The shopping amount could not change.')
      }
      if (body.revision !== undefined) setMutationRevision(body.revision)
      setMessage(body.detail ?? 'Shopping amount updated.')
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The shopping amount could not change.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="bg-muted/20 rounded-[var(--radius-control)] border p-3"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label
            className="text-muted-foreground mb-1 block text-xs"
            htmlFor={`shopping-amount-${item.id}`}
          >
            Shopping amount for {item.ingredientName}
          </label>
          <div className="flex items-center gap-2">
            <Input
              aria-describedby={`shopping-amount-help-${item.id}`}
              disabled={!editable || pending}
              id={`shopping-amount-${item.id}`}
              inputMode="decimal"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              required
              step="any"
              type="number"
              value={amount}
            />
            <span className="font-data text-sm">{item.unit.name}</span>
          </div>
          <p
            className="text-muted-foreground mt-1 text-xs"
            id={`shopping-amount-help-${item.id}`}
          >
            Calculated requirement:{' '}
            {formatQuantity(item.calculatedRequirement, item.unit)}
          </p>
        </div>
        <Button disabled={!editable || pending || !amount.trim()} type="submit">
          {pending ? 'Saving…' : 'Set shopping amount'}
        </Button>
      </div>
      {!editable && (
        <p className="text-muted-foreground mt-2 text-xs">
          This archived list is read-only. Shopping amounts cannot change until
          the list is unarchived.
        </p>
      )}
      <p aria-live="polite" className="text-muted-foreground mt-2 text-xs">
        {error ?? message}
      </p>
    </form>
  )
}
