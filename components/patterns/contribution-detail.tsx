import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GroceryContribution, GroceryItem } from '@/lib/recipes/groceries'
import { SplitGroceryContributionButton } from '@/components/lists/split-grocery-contribution-button'

function formatQuantity(
  quantity: GroceryContribution['calculatedQuantity'],
  unit?: string,
) {
  if (!quantity) return 'As needed'
  const amount = quantity.max ? `${quantity.min}–${quantity.max}` : quantity.min
  return unit ? `${amount} ${unit}` : amount
}

function contributionSource(contribution: GroceryContribution) {
  return contribution.source.kind === 'recipe'
    ? contribution.source.recipeTitle
    : 'Manual grocery item'
}

export function ContributionDetail({
  item,
  listId,
  baseRevision,
  editable = true,
}: {
  item?: GroceryItem
  listId?: string
  baseRevision?: number
  editable?: boolean
}) {
  if (!item) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contribution detail</CardTitle>
          <p className="text-muted-foreground text-sm">
            This is how the calculated requirement was formed.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>1 onion from Tacos</span>
            <span className="font-data">1</span>
          </div>
          <div className="flex justify-between">
            <span>1 onion from Curry</span>
            <span className="font-data">1</span>
          </div>
          <div className="border-t pt-3 font-medium">
            <div className="flex justify-between">
              <span>Calculated requirement</span>
              <span className="font-data">2 onions</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <details className="max-w-full min-w-0">
      <summary className="text-primary flex min-h-11 max-w-full cursor-pointer items-center justify-end text-right text-sm font-medium break-words underline-offset-4 hover:underline">
        View{' '}
        {item.contributions.length === 1 ? 'contribution' : 'contributions'}
      </summary>
      <div className="bg-muted/30 mt-2 space-y-3 rounded-md border p-3 text-sm">
        <p className="font-medium">How this item was calculated</p>
        <div
          aria-label={`Contributions to ${item.ingredientName}`}
          className="space-y-3"
          role="list"
        >
          {item.contributions.map((contribution) => (
            <div className="space-y-1" key={contribution.id} role="listitem">
              <div className="flex items-start justify-between gap-3">
                <span>{contributionSource(contribution)}</span>
                <span className="font-data shrink-0">
                  {formatQuantity(
                    contribution.calculatedQuantity,
                    contribution.unit.name,
                  )}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {contribution.originalText}
                {contribution.optional ? ' · Optional' : ''}
              </p>
              {item.contributions.length > 1 && listId && editable && (
                <SplitGroceryContributionButton
                  baseRevision={baseRevision}
                  contributionId={contribution.id}
                  contributionLabel={contribution.originalText}
                  editable={editable}
                  ingredientName={item.ingredientName}
                  itemId={item.id}
                  listId={listId}
                />
              )}
            </div>
          ))}
        </div>
        <div className="border-t pt-3 font-medium">
          <div className="flex justify-between gap-3">
            <span>Calculated requirement</span>
            <span className="font-data">
              {formatQuantity(item.calculatedRequirement, item.unit.name)}
            </span>
          </div>
          {item.override && (
            <p className="text-muted-foreground mt-1 text-xs">
              Shopping amount:{' '}
              {formatQuantity(item.shoppingAmount, item.unit.name)}
            </p>
          )}
        </div>
      </div>
    </details>
  )
}
