import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContributionDetail } from '@/components/patterns/contribution-detail'
import type {
  GroceryItem,
  GroceryMergeSuggestion,
} from '@/lib/recipes/groceries'

function formatQuantity(item: GroceryItem) {
  if (!item.shoppingAmount) return 'As needed'
  const amount = item.shoppingAmount.max
    ? `${item.shoppingAmount.min}–${item.shoppingAmount.max}`
    : item.shoppingAmount.min
  return item.unit.name ? `${amount} ${item.unit.name}` : amount
}

function suggestionSource(item: GroceryItem) {
  const contribution = item.contributions[0]
  if (!contribution) return 'another grocery item'
  return contribution.source.kind === 'recipe'
    ? contribution.source.recipeTitle
    : 'a manual grocery item'
}

export function GroceryRow({
  item,
  ingredient,
  amount,
  category = 'Produce',
  state = 'buy',
  mergeSuggestions = [],
}: {
  item?: GroceryItem
  ingredient?: string
  amount?: string
  category?: string
  state?: 'buy' | 'already-have' | 'purchased'
  mergeSuggestions?: readonly GroceryMergeSuggestion[]
}) {
  const itemIngredient = item?.ingredientName ?? ingredient ?? 'Grocery item'
  const itemAmount = item
    ? item.shoppingAmount
      ? `${item.shoppingAmount.max ? `${item.shoppingAmount.min}–${item.shoppingAmount.max}` : item.shoppingAmount.min}${item.unit.name ? ` ${item.unit.name}` : ''}`
      : 'As needed'
    : (amount ?? 'As needed')

  return (
    <div className="space-y-2">
      <Card className="flex min-h-16 items-center gap-3 rounded-lg p-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-data text-sm font-medium">{itemAmount}</span>
            <span>{itemIngredient}</span>
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            <span>{category}</span>
            <span aria-hidden="true">·</span>
            <span>
              {state === 'already-have'
                ? 'Already have'
                : state === 'purchased'
                  ? 'Purchased'
                  : item
                    ? `${item.contributions.length} ${item.contributions.length === 1 ? 'contribution' : 'contributions'}`
                    : 'From Tacos + Curry'}
            </span>
          </div>
        </div>
        <Badge
          variant={
            state === 'purchased'
              ? 'success'
              : state === 'already-have'
                ? 'secondary'
                : 'outline'
          }
        >
          {state === 'buy'
            ? 'To buy'
            : state === 'already-have'
              ? 'Already have'
              : 'Purchased'}
        </Badge>
        {item ? (
          <ContributionDetail item={item} />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`View contribution details for ${itemIngredient}`}
          >
            <MoreHorizontal size={18} />
          </Button>
        )}
      </Card>
      {mergeSuggestions.map((suggestion) => {
        const otherItem =
          suggestion.left.id === item?.id ? suggestion.right : suggestion.left
        const otherContribution = otherItem.contributions[0]
        return (
          <div
            className="border-warning/40 bg-warning/10 text-warning-foreground rounded-[var(--radius-card)] border p-3 text-sm"
            key={suggestion.id}
            role="note"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Possible match</Badge>
              <span>
                This item may match {formatQuantity(otherItem)}{' '}
                {otherItem.ingredientName} from {suggestionSource(otherItem)}.
              </span>
            </div>
            <p className="mt-2">
              It stays separate because the ingredient parse is uncertain. No
              amount has been combined.
            </p>
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer pt-3 font-medium underline-offset-4 hover:underline">
                Compare possible match
              </summary>
              <div className="border-warning/40 mt-2 space-y-1 border-t pt-3 text-xs">
                <p>
                  {otherItem.dimension} · {otherItem.unit.name || 'no unit'} ·{' '}
                  {formatQuantity(otherItem)}
                </p>
                {otherContribution && <p>{otherContribution.originalText}</p>}
              </div>
            </details>
          </div>
        )
      })}
    </div>
  )
}
