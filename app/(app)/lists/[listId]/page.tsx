import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { findActiveShoppingRun, findListForMember } from '@/lib/lists'
import { notFound } from 'next/navigation'
import { RenameListForm } from '@/components/lists/rename-list-form'
import { LeaveListButton } from '@/components/lists/leave-list-button'
import { ListLifecycleActions } from '@/components/lists/list-lifecycle-actions'
import { SelectionPeopleForm } from '@/components/lists/selection-people-form'
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  isPubliclyRenderableRecipe,
  type RecipeDraftDocument,
  type RecipeShareDocument,
} from '@/lib/recipes/drafts'
import { generateGroceryItems } from '@/lib/recipes/groceries'

export default async function ListPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}`)
  const list = await findListForMember(listId, session.user.id)
  if (!list || list.status === 'deleted') notFound()
  const run = await findActiveShoppingRun(list)
  const db = await getConnectedDatabase()
  const resolvedSelections = run
    ? await resolveRunRecipeVersions(db, run.recipeSelections)
    : []
  const selections = run?.recipeSelections ?? []
  const groceryItems = generateGroceryItems({
    selections: resolvedSelections.flatMap(({ version }, index) => {
      const selection = selections[index]
      return selection && version ? [{ selection, version }] : []
    }),
    manualAdditions: run?.manualAdditions ?? [],
    overrides: run?.groceryAmountOverrides ?? [],
  })
  const recipeIds = [
    ...new Set(selections.map((selection) => selection.recipeId)),
  ]
  const currentRecipes =
    recipeIds.length > 0
      ? await db
          .collection<RecipeDraftDocument>('recipes')
          .find({ _id: { $in: recipeIds }, status: 'usable' })
          .toArray()
      : []
  const currentRecipesById = new Map(
    currentRecipes.map((recipe) => [recipe.recipeId ?? recipe._id, recipe]),
  )
  const sharedRecipeIds = new Set(
    (recipeIds.length > 0
      ? await db
          .collection<RecipeShareDocument>('recipe_shares')
          .find({ listId, recipeId: { $in: recipeIds } })
          .project({ recipeId: 1 })
          .toArray()
      : []
    ).map((share) => share.recipeId),
  )

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="List"
        title={list.name}
        description="Your current recipe selections and shopping run summary."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/lists/${listId}/members`}>Manage members</Link>
            </Button>
            {list.status === 'active' ? (
              <Button asChild>
                <Link href={`/lists/${listId}/review`}>Review at home</Link>
              </Button>
            ) : (
              <Badge variant="outline">Archived</Badge>
            )}
          </div>
        }
      />
      {list.status === 'archived' && (
        <p className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 rounded-[var(--radius-card)] border p-4 text-sm">
          This list is archived. Its shared shopping run is read-only until an
          owner unarchives it.
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current shopping run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Recipes</span>
              <Badge variant="outline">
                {run?.recipeSelections.length ?? 0}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Grocery items</span>
              <span className="font-data">{groceryItems.length}</span>
            </div>
            {list.status === 'active' ? (
              <Button className="w-full" asChild>
                <Link href={`/lists/${listId}/shop`}>Start shopping</Link>
              </Button>
            ) : (
              <Button className="w-full" disabled>
                Shopping unavailable while archived
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Selected recipes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {resolvedSelections.length === 0 ? (
              <>
                <p className="text-muted-foreground">
                  No recipes selected yet.
                </p>
                <Link
                  className="text-primary inline-block min-h-11 pt-3"
                  href="/discover"
                >
                  Choose a recipe
                </Link>
              </>
            ) : (
              resolvedSelections.map(({ version }, index) => {
                const selection = selections[index]
                if (!selection || !version) return null
                const currentRecipe = currentRecipesById.get(selection.recipeId)
                const canViewCurrentRecipe =
                  currentRecipe &&
                  (currentRecipe.ownerId === session.user.id ||
                    isPubliclyRenderableRecipe(currentRecipe) ||
                    (currentRecipe.visibility === 'list-shared' &&
                      sharedRecipeIds.has(selection.recipeId)))
                const newerVersionNumber =
                  canViewCurrentRecipe &&
                  (currentRecipe.versionNumber ?? 1) > selection.versionNumber
                    ? (currentRecipe.versionNumber ?? 1)
                    : undefined
                return (
                  <SelectionPeopleForm
                    initialPeople={selection.desiredPeople}
                    initialScaleFactor={selection.scaleFactor}
                    baseRevision={run?.revision}
                    key={selection._id}
                    listId={listId}
                    listName={list.name}
                    newerVersionNumber={newerVersionNumber}
                    recipeId={selection.recipeId}
                    recipeTitle={version.title}
                    selectionId={selection._id}
                    editable={list.status === 'active'}
                  />
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
      {list.ownerIds.includes(session.user.id) && (
        <>
          <div className="mt-6 max-w-2xl">
            <RenameListForm listId={listId} currentName={list.name} />
          </div>
          <div className="mt-6 max-w-2xl">
            <ListLifecycleActions
              listId={listId}
              listName={list.name}
              status={list.status}
            />
          </div>
        </>
      )}
      {list.members.some((member) => member.userId === session.user.id) && (
        <div className="mt-6 max-w-2xl">
          <LeaveListButton
            listId={listId}
            listName={list.name}
            canLeave={
              !list.ownerIds.includes(session.user.id) ||
              list.ownerIds.length > 1
            }
          />
        </div>
      )}
    </ContentContainer>
  )
}
