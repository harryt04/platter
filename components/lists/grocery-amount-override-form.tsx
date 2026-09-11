'use client'

import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import type { GroceryItem } from '@/lib/recipes/groceries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SyncStatus } from '@/components/states/sync-status'
import { browserIsOffline, queueBrowserMutation } from '@/lib/offline/mutations'
import { formatIngredientQuantity } from '@/lib/recipes/unit-presentation'

function formatSuggestion(item: GroceryItem, locale: string) {
  const suggestion = item.suggestedShoppingAmount
  if (!suggestion) return null
  return formatIngredientQuantity(suggestion.quantity, item.unit, locale)
}

export function GroceryAmountOverrideForm({
  item,
  listId,
  baseRevision,
  runId,
  userId,
  editable = true,
  locale = 'en-US',
}: {
  item: GroceryItem
  listId: string
  baseRevision?: number
  runId?: string
  userId?: string
  editable?: boolean
  locale?: string
}) {
  const router = useRouter()
  const [mutationRevision, setMutationRevision] = React.useState<number>()
  const [amount, setAmount] = React.useState(
    item.override?.min ?? item.calculatedRequirement?.min ?? '',
  )
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [offlinePending, setOfflinePending] = React.useState(false)
  const suggestion = formatSuggestion(item, locale)

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
      if (browserIsOffline()) {
        await queueBrowserMutation({
          userId,
          listId,
          runId,
          baseRevision: currentRevision,
          kind: 'grocery.amount-override.set',
          payload: { itemId: item.id, quantity: { min: amount.trim() } },
        })
        setOfflinePending(true)
        setMessage(
          'Saved on this device. We’ll sync it when you’re back online.',
        )
        return
      }
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(item.id)}/override`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            quantity: { min: amount.trim() },
            ...createMutationMetadata(currentRevision, runId),
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
      setOfflinePending(false)
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

  async function reset() {
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      if (browserIsOffline()) {
        await queueBrowserMutation({
          userId,
          listId,
          runId,
          baseRevision: currentRevision,
          kind: 'grocery.amount-override.reset',
          payload: { itemId: item.id },
        })
        setAmount(item.calculatedRequirement?.min ?? '')
        setOfflinePending(true)
        setMessage(
          'Saved on this device. We’ll sync it when you’re back online.',
        )
        return
      }
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(item.id)}/override`,
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(createMutationMetadata(currentRevision, runId)),
        },
      )
      const body = (await response.json()) as {
        detail?: string
        revision?: number
        shoppingAmount?: GroceryItem['shoppingAmount']
      }
      if (!response.ok) {
        throw new Error(body.detail ?? 'The shopping amount could not reset.')
      }
      if (body.revision !== undefined) setMutationRevision(body.revision)
      setAmount(
        body.shoppingAmount?.min ?? item.calculatedRequirement?.min ?? '',
      )
      setMessage(
        body.detail ?? 'Shopping amount reset to calculated requirement.',
      )
      setOfflinePending(false)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The shopping amount could not reset.',
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
            {formatIngredientQuantity(
              item.calculatedRequirement,
              item.unit,
              locale,
            )}
          </p>
          {suggestion && (
            <div
              className="border-warning/40 bg-warning/10 text-warning-foreground mt-2 rounded-md border p-2 text-xs"
              role="note"
            >
              <p>
                Optional guidance: {suggestion} to buy whole units. This is a
                suggestion, not a guaranteed fact.
              </p>
              <Button
                className="mt-1 min-h-11 px-0"
                disabled={!editable || pending}
                onClick={() => {
                  setAmount(item.suggestedShoppingAmount!.quantity.min)
                  setMessage(null)
                  setError(null)
                }}
                type="button"
                variant="ghost"
              >
                Use whole-unit suggestion for {item.ingredientName}
              </Button>
            </div>
          )}
        </div>
        <Button disabled={!editable || pending || !amount.trim()} type="submit">
          {pending ? 'Saving…' : 'Set shopping amount'}
        </Button>
        {item.override && (
          <Button
            aria-label={`Reset shopping amount for ${item.ingredientName}`}
            disabled={!editable || pending}
            onClick={reset}
            type="button"
            variant="outline"
          >
            <RotateCcw size={16} />
            Reset to calculated amount
          </Button>
        )}
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
      {offlinePending && <SyncStatus state="pending" />}
    </form>
  )
}
