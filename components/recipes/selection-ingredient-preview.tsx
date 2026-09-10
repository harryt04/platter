import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type SelectionIngredientPreviewItem = {
  ingredientName: string
  unit?: string
  preparationNote?: string
  optional: boolean
  calculatedQuantity: {
    min: string
    max?: string
  } | null
}

function formatQuantity(
  quantity: SelectionIngredientPreviewItem['calculatedQuantity'],
) {
  if (!quantity) return 'As needed'
  if (quantity.max) return `${quantity.min}–${quantity.max}`
  return quantity.min
}

export function SelectionIngredientPreview({
  ingredients,
}: {
  ingredients: SelectionIngredientPreviewItem[]
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Calculated ingredients</CardTitle>
        <p className="text-muted-foreground text-sm">
          These amounts are scaled for this recipe selection. Ingredients
          without an authored quantity stay readable without an invented amount.
        </p>
      </CardHeader>
      <CardContent>
        {ingredients.length > 0 ? (
          <div
            aria-label="Calculated ingredients"
            className="space-y-3"
            role="list"
          >
            {ingredients.map((ingredient, index) => (
              <div
                className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                key={`${ingredient.ingredientName}-${index}`}
                role="listitem"
              >
                <span className="font-data shrink-0">
                  {formatQuantity(ingredient.calculatedQuantity)}
                  {ingredient.unit ? ` ${ingredient.unit}` : null}
                </span>
                <span className="text-right">
                  {ingredient.ingredientName}
                  {ingredient.preparationNote
                    ? `, ${ingredient.preparationNote}`
                    : null}
                  {ingredient.optional ? (
                    <Badge className="ml-2 align-middle" variant="outline">
                      Optional
                    </Badge>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            This recipe has no ingredients yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
