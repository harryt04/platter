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
import { ShoppingModeNavigation } from '@/components/lists/shopping-mode-navigation'
import { GroceryCategorySelect } from '@/components/lists/grocery-category-select'
import { GroceryItemOrderControls } from '@/components/lists/grocery-item-order-controls'
import { GroceryCategoryOrderSection } from '@/components/lists/grocery-category-order-section'
import { groupGroceryItemsByCategoryOrder } from '@/lib/recipes/grocery-categories'
import { PurchasedButton } from '@/components/lists/purchased-button'
import { RealtimeRunSync } from '@/components/states/realtime-run-sync'
import { OfflineRunSnapshotWriter } from '@/components/states/offline-snapshot-writers'

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
    categoryOverrides: run?.groceryCategoryOverrides ?? [],
    splitContributionIds:
      run?.groceryMergeSplits?.map(({ contributionId }) => contributionId) ??
      [],
  })
  const mergeSuggestions = findGroceryMergeSuggestions(groceryItems)
  const alreadyHaveItemIds = new Set(
    run?.alreadyHaveItems?.map(({ itemId }) => itemId) ?? [],
  )
  const purchasedItemIds = new Set(
    run?.purchasedItems?.map(({ itemId }) => itemId) ?? [],
  )
  const buyGroceryItems = groceryItems.filter(
    (item) => !alreadyHaveItemIds.has(item.id),
  )
  const groceryItemGroups = groupGroceryItemsByCategoryOrder(
    buyGroceryItems,
    run?.ordering,
    run?.categoryOrdering,
  )
  const offlineRecipeSelections = resolvedSelections.flatMap(
    ({ version }, index) => {
      const selection = selections[index]
      return selection && version
        ? [
            {
              id: selection._id,
              title: version.title,
              desiredPeople: selection.desiredPeople,
            },
          ]
        : []
    },
  )

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Shopping run"
        description="Mark each item purchased as you move through the store."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ShoppingModeNavigation listId={listId} mode="shopping" />
            <Button disabled={isReadOnly} className="w-full sm:w-auto">
              {isReadOnly
                ? 'Shopping unavailable while archived'
                : 'Complete shopping run'}
            </Button>
          </div>
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
        <RealtimeRunSync
          currentUserId={session.user.id}
          listId={listId}
          revision={run?.revision ?? 0}
          runId={run?._id ?? list.activeRunId}
        />
        <OfflineRunSnapshotWriter
          payload={{
            kind: 'run',
            listId,
            listName: list.name,
            listStatus: list.status === 'archived' ? 'archived' : 'active',
            runId: run?._id ?? list.activeRunId,
            revision: run?.revision ?? 0,
            recipeSelections: offlineRecipeSelections,
            groceryItemCount: groceryItems.length,
          }}
          updatedAt={run?.updatedAt ?? list.updatedAt}
          userId={session.user.id}
        />
      </div>
      <PageSection title="Grocery items">
        {buyGroceryItems.length > 0 ? (
          <div className="space-y-6">
            {groceryItemGroups.map(({ category, items }) => (
              <GroceryCategoryOrderSection
                baseRevision={run?.revision}
                categories={groceryItemGroups.map(({ category }) => category)}
                category={category}
                editable={!isReadOnly}
                key={category}
                listId={listId}
              >
                {items.map((item, itemIndex) => (
                  <div className="space-y-2" key={item.id} role="listitem">
                    <GroceryRow
                      item={item}
                      mergeSuggestions={mergeSuggestions.filter(
                        (suggestion) => suggestion.left.id === item.id,
                      )}
                      baseRevision={run?.revision}
                      listId={listId}
                      editable={!isReadOnly}
                      state={
                        purchasedItemIds.has(item.id) ? 'purchased' : 'buy'
                      }
                    />
                    <PurchasedButton
                      baseRevision={run?.revision}
                      editable={!isReadOnly}
                      ingredientName={item.ingredientName}
                      itemId={item.id}
                      listId={listId}
                      marked={purchasedItemIds.has(item.id)}
                      runId={run?._id ?? list.activeRunId}
                      userId={session.user.id}
                    />
                    <GroceryCategorySelect
                      baseRevision={run?.revision}
                      category={item.category}
                      editable={!isReadOnly}
                      ingredientName={item.ingredientName}
                      itemId={item.id}
                      listId={listId}
                    />
                    <GroceryItemOrderControls
                      baseRevision={run?.revision}
                      canMoveDown={itemIndex < items.length - 1}
                      canMoveUp={itemIndex > 0}
                      editable={!isReadOnly}
                      ingredientName={item.ingredientName}
                      itemId={item.id}
                      listId={listId}
                    />
                    <GroceryAmountOverrideForm
                      baseRevision={run?.revision}
                      editable={!isReadOnly}
                      item={item}
                      listId={listId}
                      runId={run?._id ?? list.activeRunId}
                      userId={session.user.id}
                    />
                  </div>
                ))}
              </GroceryCategoryOrderSection>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {groceryItems.length > 0
              ? 'Everything in this run is marked already have. Review at home if you want to add an item back.'
              : 'This shopping run has no grocery items yet. Choose a recipe to add its ingredients.'}
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
