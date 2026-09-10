import type { GroceryItem } from '@/lib/recipes/groceries'

function formatQuantity(
  quantity: GroceryItem['calculatedRequirement'],
  unit: GroceryItem['unit'],
) {
  if (!quantity) return 'no calculated requirement'
  const amount = quantity.max ? `${quantity.min}–${quantity.max}` : quantity.min
  return unit.name ? `${amount} ${unit.name}` : amount
}

export function GroceryOverrideWarning({ item }: { item: GroceryItem }) {
  if (!item.overrideWarning || !item.override) return null

  return (
    <p
      className="border-warning/40 bg-warning/10 text-warning-foreground rounded-md border p-3 text-xs"
      role="alert"
    >
      Your intended shopping amount remains{' '}
      <span className="font-data">
        {formatQuantity(item.override, item.unit)}
      </span>
      . The calculated requirement changed from{' '}
      <span className="font-data">
        {formatQuantity(
          item.overrideWarning.previousCalculatedRequirement,
          item.unit,
        )}
      </span>{' '}
      to{' '}
      <span className="font-data">
        {formatQuantity(
          item.overrideWarning.currentCalculatedRequirement,
          item.unit,
        )}
      </span>
      . Review this override before shopping.
    </p>
  )
}
