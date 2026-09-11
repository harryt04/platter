import type { GroceryItem } from '@/lib/recipes/groceries'
import { formatIngredientQuantity } from '@/lib/recipes/unit-presentation'

export function GroceryOverrideWarning({
  item,
  locale = 'en-US',
}: {
  item: GroceryItem
  locale?: string
}) {
  if (!item.overrideWarning || !item.override) return null

  return (
    <p
      className="border-warning/40 bg-warning/10 text-warning-foreground rounded-md border p-3 text-xs"
      role="alert"
    >
      Your intended shopping amount remains{' '}
      <span className="font-data">
        {formatIngredientQuantity(item.override, item.unit, locale)}
      </span>
      . The calculated requirement changed from{' '}
      <span className="font-data">
        {formatIngredientQuantity(
          item.overrideWarning.previousCalculatedRequirement,
          item.unit,
          locale,
        )}
      </span>{' '}
      to{' '}
      <span className="font-data">
        {formatIngredientQuantity(
          item.overrideWarning.currentCalculatedRequirement,
          item.unit,
          locale,
        )}
      </span>
      . Review this override before shopping.
    </p>
  )
}
