import type { RecipeIngredient } from '@/lib/recipes/drafts'

export function PublicRecipeIngredients({
  ingredients,
}: {
  ingredients: RecipeIngredient[]
}) {
  if (ingredients.length === 0) {
    return <p className="text-muted-foreground">No ingredients listed.</p>
  }

  return ingredients.map((ingredient, index) => (
    <div
      className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
      key={`${ingredient.originalText}-${index}`}
    >
      <span className="font-data text-right">
        {[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') ||
          'As needed'}
      </span>
      <span className="text-right">
        {ingredient.ingredientName}
        {ingredient.preparationNote ? `, ${ingredient.preparationNote}` : null}
        {ingredient.optional ? ' (optional)' : null}
      </span>
    </div>
  ))
}
