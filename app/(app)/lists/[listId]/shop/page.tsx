import { GroceryRow } from '@/components/patterns/grocery-row'
import { SyncStatus } from '@/components/states/sync-status'
import { Button } from '@/components/ui/button'
import {
  ContentContainer,
  PageHeader,
  PageSection,
} from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import {
  findActiveShoppingRun,
  findListForMember,
  listAcceptsShoppingOperations,
} from '@/lib/lists'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'
import {
  findGroceryMergeSuggestions,
  generateGroceryItems,
} from '@/lib/recipes/groceries'
import { notFound } from 'next/navigation'
import { GroceryAmountOverrideForm } from '@/components/lists/grocery-amount-override-form'
import { ManualGroceryItems } from '@/components/lists/manual-grocery-items'

export default async function ShopPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}/shop`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  const isReadOnly = !listAcceptsShoppingOperations(list)
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
    splitContributionIds:
      run?.groceryMergeSplits?.map(({ contributionId }) => contributionId) ??
      [],
  })
  const mergeSuggestions = findGroceryMergeSuggestions(groceryItems)

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Shopping run"
        description="Mark each item purchased as you move through the store."
        action={
          <Button disabled={isReadOnly}>
            {isReadOnly
              ? 'Shopping unavailable while archived'
              : 'Complete shopping run'}
          </Button>
        }
      />
      {isReadOnly && (
        <p className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 rounded-[var(--radius-card)] border p-4 text-sm">
          This list is archived. The shopping run is read-only until an owner
          unarchives it.
        </p>
      )}
      <div className="mb-6">
        <SyncStatus state="synced" />
      </div>
      <PageSection title="Grocery items">
        {groceryItems.length > 0 ? (
          <div className="space-y-3">
            {groceryItems.map((item) => (
              <div className="space-y-2" key={item.id}>
                <GroceryRow
                  item={item}
                  category="Other"
                  mergeSuggestions={mergeSuggestions.filter(
                    (suggestion) => suggestion.left.id === item.id,
                  )}
                  baseRevision={run?.revision}
                  listId={listId}
                  editable={!isReadOnly}
                />
                <GroceryAmountOverrideForm
                  baseRevision={run?.revision}
                  editable={!isReadOnly}
                  item={item}
                  listId={listId}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            This shopping run has no grocery items yet. Choose a recipe to add
            its ingredients.
          </p>
        )}
      </PageSection>
      <ManualGroceryItems
        additions={run?.manualAdditions ?? []}
        baseRevision={run?.revision}
        editable={!isReadOnly}
        listId={listId}
        listName={list.name}
      />
    </ContentContainer>
  )
}
