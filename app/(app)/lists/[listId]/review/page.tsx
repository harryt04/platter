import { GroceryRow } from '@/components/patterns/grocery-row'
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
import { AlreadyHaveButton } from '@/components/lists/already-have-button'
import { GroceryCategorySelect } from '@/components/lists/grocery-category-select'
import { GroceryItemOrderControls } from '@/components/lists/grocery-item-order-controls'
import { GroceryCategoryOrderSection } from '@/components/lists/grocery-category-order-section'
import { ShoppingModeNavigation } from '@/components/lists/shopping-mode-navigation'
import { groupGroceryItemsByCategoryOrder } from '@/lib/recipes/grocery-categories'
import { PurchasedButton } from '@/components/lists/purchased-button'
import { RealtimeRunSync } from '@/components/states/realtime-run-sync'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}/review`)
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
  const purchasedItemIds = new Set(
    run?.purchasedItems?.map(({ itemId }) => itemId) ?? [],
  )
  const groceryItemGroups = groupGroceryItemsByCategoryOrder(
    groceryItems,
    run?.ordering,
    run?.categoryOrdering,
  )

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Review at home"
        description="Check what you already have before you start shopping. The source recipes stay unchanged."
        action={<ShoppingModeNavigation listId={listId} mode="review" />}
      />
      {isReadOnly && (
        <p className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 rounded-[var(--radius-card)] border p-4 text-sm">
          This list is archived. The shopping run is read-only until an owner
          unarchives it.
        </p>
      )}
      <RealtimeRunSync
        listId={listId}
        revision={run?.revision ?? 0}
        runId={run?._id ?? list.activeRunId}
      />
      <PageSection title="Grocery items">
        {groceryItems.length > 0 ? (
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
                      showCalculatedRequirement
                    />
                    <AlreadyHaveButton
                      baseRevision={run?.revision}
                      editable={!isReadOnly}
                      ingredientName={item.ingredientName}
                      itemId={item.id}
                      listId={listId}
                      marked={Boolean(
                        run?.alreadyHaveItems?.some(
                          (alreadyHave) => alreadyHave.itemId === item.id,
                        ),
                      )}
                    />
                    <PurchasedButton
                      baseRevision={run?.revision}
                      editable={!isReadOnly}
                      ingredientName={item.ingredientName}
                      itemId={item.id}
                      listId={listId}
                      marked={purchasedItemIds.has(item.id)}
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
                    />
                  </div>
                ))}
              </GroceryCategoryOrderSection>
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
