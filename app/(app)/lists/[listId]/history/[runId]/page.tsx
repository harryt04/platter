import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { findListForMember } from '@/lib/lists'
import {
  findShoppingRunHistory,
  formatShoppingRunHistoryDate,
} from '@/lib/shopping-run-history'
import { resolvePinnedRecipeVersions } from '@/lib/recipes/versions'
import type { RecipeVersionDocument } from '@/lib/recipes/drafts'

export default async function RunHistoryPage({
  params,
}: {
  params: Promise<{ listId: string; runId: string }>
}) {
  const { listId, runId } = await params
  const session = await requireSession(`/lists/${listId}/history/${runId}`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()

  const db = await getConnectedDatabase()
  const history = await findShoppingRunHistory(db, listId, runId)
  if (!history) notFound()

  const pinnedSelections = await resolvePinnedRecipeVersions(
    db.collection<RecipeVersionDocument>('recipe_versions'),
    history.recipeSelections,
  )
  const resolvedSelections = history.recipeSelections.map(
    (selection, index) => ({
      reference: selection,
      version: pinnedSelections[index]?.version ?? null,
    }),
  )

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Completed shopping run"
        description="These are the recipes this list shopped for. This history does not show the final checklist or claim that the recipes were cooked or that every item was purchased."
        action={
          <Button variant="outline" asChild>
            <Link href={`/lists/${listId}/history`}>Back to history</Link>
          </Button>
        }
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>
            <time dateTime={history.localDate}>
              {formatShoppingRunHistoryDate(history.localDate)}
            </time>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Completed by {history.completedByUserId}
          </p>
        </CardHeader>
        <CardContent>
          <h2 className="mb-3 text-lg font-medium">Recipes shopped for</h2>
          {resolvedSelections.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No recipes were selected for this shopping run.
            </p>
          ) : (
            <ul className="space-y-3" aria-label="Recipes shopped for">
              {resolvedSelections.map(({ reference, version }) => (
                <li className="rounded-md border p-4" key={reference._id}>
                  <p className="font-medium">
                    {version?.title ?? 'Recipe version unavailable'}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Version {reference.versionNumber} ·{' '}
                    {reference.desiredPeople}{' '}
                    {reference.desiredPeople === 1 ? 'person' : 'people'}
                  </p>
                  {!version && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      The immutable recipe details are no longer available, but
                      this historical selection remains recorded.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </ContentContainer>
  )
}
