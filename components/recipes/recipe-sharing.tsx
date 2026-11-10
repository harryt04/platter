'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { RecipeOrigin, RecipeVisibility } from '@/lib/recipes/drafts'

type ShareableList = {
  id: string
  name: string
  status: 'active' | 'archived' | 'deleted'
}

export function RecipeSharing({
  recipeId,
  status,
  origin,
  visibility,
  lists,
  initialSharedListIds,
}: {
  recipeId: string
  status: 'draft' | 'usable'
  origin: RecipeOrigin
  visibility: RecipeVisibility
  lists: ShareableList[]
  initialSharedListIds: string[]
}) {
  const [selectedListIds, setSelectedListIds] = useState(initialSharedListIds)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const canShare = status === 'usable' && origin === 'authored'
  const [publishPublic, setPublishPublic] = useState(visibility === 'public')

  function toggleList(listId: string, checked: boolean) {
    setSelectedListIds((current) =>
      checked
        ? current.includes(listId)
          ? current
          : [...current, listId]
        : current.filter((currentId) => currentId !== listId),
    )
  }

  async function saveSharing() {
    setBusy(true)
    setError('')
    setSaved('')
    try {
      const response = await fetch(`/api/v1/recipes/${recipeId}/shares`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listIds: selectedListIds, publishPublic }),
      })
      if (!response.ok) {
        const problem = (await response.json()) as { detail?: string }
        throw new Error(problem.detail ?? 'We couldn’t update recipe sharing.')
      }
      const result = (await response.json()) as {
        visibility: RecipeVisibility
        listIds: string[]
      }
      setSelectedListIds(result.listIds)
      setPublishPublic(result.visibility === 'public')
      setSaved(
        result.visibility === 'public'
          ? 'This recipe is published to the public catalog.'
          : result.visibility === 'list-shared'
            ? 'This recipe is shared with the selected lists.'
            : 'This recipe is private again.',
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t update recipe sharing.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle>Recipe sharing</CardTitle>
        <CardDescription>
          Recipes are private by default. Share this recipe only with lists you
          choose; list members will not receive access to your other lists.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!canShare ? (
          <p className="text-muted-foreground text-sm" role="status">
            Complete this authored recipe with a yield and at least one
            ingredient before sharing it with a list.
          </p>
        ) : (
          <>
            <label className="hover:bg-muted flex min-h-11 items-center gap-3 rounded-md px-2">
              <Checkbox
                checked={publishPublic}
                disabled={busy}
                onChange={(event) => setPublishPublic(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">
                  Publish to the public catalog
                </span>
                <span className="text-muted-foreground block text-xs">
                  Anyone can read this recipe. Source and attribution remain
                  visible.
                </span>
              </span>
            </label>
            {!publishPublic && lists.length === 0 ? (
              <p className="text-muted-foreground text-sm" role="status">
                You do not belong to any lists yet. Create or join a list before
                sharing this recipe.
              </p>
            ) : !publishPublic ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Share with selected lists
                </legend>
                {lists.map((list) => (
                  <Label
                    className="hover:bg-muted flex min-h-11 items-center gap-3 rounded-md px-2"
                    key={list.id}
                  >
                    <Checkbox
                      checked={selectedListIds.includes(list.id)}
                      disabled={
                        busy ||
                        (list.status !== 'active' &&
                          !selectedListIds.includes(list.id))
                      }
                      onChange={(event) =>
                        toggleList(list.id, event.target.checked)
                      }
                    />
                    <span>
                      {list.name}
                      {list.status === 'archived' && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          Archived
                        </span>
                      )}
                    </span>
                  </Label>
                ))}
              </fieldset>
            ) : null}
          </>
        )}
        {canShare && (
          <Button disabled={busy} onClick={saveSharing}>
            {busy ? 'Saving…' : 'Save sharing'}
          </Button>
        )}
        {saved && (
          <p
            className="text-sm text-green-700 dark:text-green-400"
            role="status"
          >
            {saved}
          </p>
        )}
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        {canShare &&
          visibility === 'list-shared' &&
          !saved &&
          !publishPublic && (
            <p className="text-muted-foreground text-xs">
              Currently shared with selected lists.
            </p>
          )}
      </CardContent>
    </Card>
  )
}
