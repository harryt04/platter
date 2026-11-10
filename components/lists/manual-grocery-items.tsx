'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import type { ManualGroceryAdditionDocument } from '@/lib/recipes/manual-groceries'

export function ManualGroceryItems({
  listId,
  listName,
  runId,
  additions,
  baseRevision,
  editable = true,
}: {
  listId: string
  listName: string
  runId?: string
  additions: readonly ManualGroceryAdditionDocument[]
  baseRevision?: number
  editable?: boolean
}) {
  const router = useRouter()
  const [mutationRevision, setMutationRevision] = React.useState<number>()
  const [newLine, setNewLine] = React.useState('')
  const [lines, setLines] = React.useState(() =>
    Object.fromEntries(
      additions.map((addition) => [
        addition.id,
        addition.ingredient.originalText,
      ]),
    ),
  )
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const currentRevision =
    mutationRevision === undefined || baseRevision === undefined
      ? (mutationRevision ?? baseRevision)
      : Math.max(mutationRevision, baseRevision)

  async function mutate(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body: Record<string, unknown>,
    pendingKey: string,
  ) {
    setPendingId(pendingKey)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ...createMutationMetadata(currentRevision, runId),
        }),
      })
      const responseBody = (await response.json()) as {
        detail?: string
        revision?: number
      }
      if (!response.ok) {
        throw new Error(
          responseBody.detail ?? 'The grocery item could not change.',
        )
      }
      if (responseBody.revision !== undefined) {
        setMutationRevision(responseBody.revision)
      }
      setMessage(responseBody.detail ?? 'Grocery item updated.')
      router.refresh()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
      return false
    } finally {
      setPendingId(null)
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const succeeded = await mutate(
      `/api/v1/lists/${encodeURIComponent(listId)}/manual-items`,
      'POST',
      { line: newLine },
      'new',
    )
    if (succeeded) setNewLine('')
  }

  async function update(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    await mutate(
      `/api/v1/lists/${encodeURIComponent(listId)}/manual-items/${encodeURIComponent(id)}`,
      'PATCH',
      { line: lines[id] ?? '' },
      id,
    )
  }

  async function remove(id: string) {
    const succeeded = await mutate(
      `/api/v1/lists/${encodeURIComponent(listId)}/manual-items/${encodeURIComponent(id)}`,
      'DELETE',
      {},
      id,
    )
    if (succeeded) {
      setConfirmId(null)
      document.getElementById(`manual-grocery-remove-${id}`)?.focus()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual grocery items</CardTitle>
        <p className="text-muted-foreground text-sm">
          Add practical needs that are not part of a recipe. These items stay
          independent from recipe versions and appear in the contribution
          breakdown as manual additions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {editable ? (
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={add}>
            <label className="sr-only" htmlFor="new-manual-grocery-item">
              Add a grocery item
            </label>
            <Input
              id="new-manual-grocery-item"
              onChange={(event) => setNewLine(event.target.value)}
              placeholder="For example, 2 bags spinach"
              value={newLine}
            />
            <Button
              disabled={pendingId !== null || !newLine.trim()}
              type="submit"
            >
              {pendingId === 'new' ? 'Adding…' : 'Add item'}
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">
            This archived list is read-only. Manual items cannot change until{' '}
            {listName} is unarchived.
          </p>
        )}
        {additions.length > 0 && (
          <div aria-label="Manual grocery items" className="space-y-3">
            {additions.map((addition, index) => (
              <form
                className="flex flex-col gap-2 rounded-[var(--radius-control)] border p-3 sm:flex-row sm:items-end"
                key={addition.id}
                onSubmit={(event) => update(event, addition.id)}
              >
                <div className="min-w-0 flex-1">
                  <label
                    className="text-muted-foreground mb-1 block text-sm"
                    htmlFor={`manual-grocery-item-${addition.id}`}
                  >
                    Manual grocery item {index + 1}
                  </label>
                  <Input
                    id={`manual-grocery-item-${addition.id}`}
                    disabled={!editable || pendingId !== null}
                    onChange={(event) =>
                      setLines((current) => ({
                        ...current,
                        [addition.id]: event.target.value,
                      }))
                    }
                    value={
                      lines[addition.id] ?? addition.ingredient.originalText
                    }
                  />
                </div>
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pendingId !== null}
                      type="submit"
                      variant="outline"
                    >
                      {pendingId === addition.id ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      id={`manual-grocery-remove-${addition.id}`}
                      onClick={() => setConfirmId(addition.id)}
                      type="button"
                      variant="destructive"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </form>
            ))}
          </div>
        )}
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {error ?? message}
        </p>
      </CardContent>
      {confirmId && (
        <AlertDialog
          aria-labelledby="remove-manual-grocery-title"
          aria-describedby="remove-manual-grocery-description"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id="remove-manual-grocery-title">
                Remove this manual grocery item?
              </AlertDialogTitle>
              <AlertDialogDescription id="remove-manual-grocery-description">
                This removes the item from the shared {listName} shopping run.
                Recipe ingredients and recipe versions stay unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={pendingId !== null}
                onClick={() => setConfirmId(null)}
                type="button"
              >
                Keep item
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={pendingId !== null}
                onClick={() => remove(confirmId)}
                type="button"
              >
                {pendingId === confirmId ? 'Removing…' : 'Remove item'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  )
}
