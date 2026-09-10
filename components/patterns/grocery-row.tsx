import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContributionDetail } from '@/components/patterns/contribution-detail'
import type { GroceryItem } from '@/lib/recipes/groceries'

export function GroceryRow({
  item,
  ingredient,
  amount,
  category = 'Produce',
  state = 'buy',
}: {
  item?: GroceryItem
  ingredient?: string
  amount?: string
  category?: string
  state?: 'buy' | 'already-have' | 'purchased'
}) {
  const itemIngredient = item?.ingredientName ?? ingredient ?? 'Grocery item'
  const itemAmount = item
    ? item.shoppingAmount
      ? `${item.shoppingAmount.max ? `${item.shoppingAmount.min}–${item.shoppingAmount.max}` : item.shoppingAmount.min}${item.unit.name ? ` ${item.unit.name}` : ''}`
      : 'As needed'
    : (amount ?? 'As needed')

  return (
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
  )
}
