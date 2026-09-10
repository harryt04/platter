import Decimal from 'decimal.js'
import { decimalString, type DecimalString } from '@/lib/contracts/ids'
import {
  parseIngredientLine,
  parseIngredientQuantity,
  type ParsedIngredientQuantity,
} from '@/lib/recipes/ingredient-parser'
import type { RecipeIngredient } from '@/lib/recipes/drafts'

const CalculationDecimal = Decimal.clone({ precision: 40 })

export type ScaledIngredient = {
  originalText: string
  ingredientName: string
  unit?: string
  preparationNote?: string
  optional: boolean
  /** The recipe's authored quantity, retained separately from calculations. */
  sourceQuantity: string | null
  /** The precise quantity required for this selection, before display rounding. */
  calculatedQuantity: ParsedIngredientQuantity | null
  /** A practical whole-unit suggestion for countable ingredients only. */
  suggestedShoppingQuantity: ParsedIngredientQuantity | null
}

function scaleValue(value: string, scaleFactor: DecimalString) {
  const scale = new CalculationDecimal(scaleFactor)
  if (!scale.isFinite() || !scale.gt(0)) {
    throw new Error('A recipe scale factor must be a positive finite number.')
  }

  return decimalString(new CalculationDecimal(value).times(scale).toString())
}

/** Scale both ends of a quantity range without friendly-display rounding. */
export function scaleIngredientQuantity(
  quantity: ParsedIngredientQuantity,
  scaleFactor: DecimalString,
): ParsedIngredientQuantity {
  return {
    min: scaleValue(quantity.min, scaleFactor),
    ...(quantity.max ? { max: scaleValue(quantity.max, scaleFactor) } : {}),
  }
}

function suggestWholeQuantity(
  quantity: ParsedIngredientQuantity,
): ParsedIngredientQuantity {
  const whole = (value: string) =>
    decimalString(new CalculationDecimal(value).ceil().toString())

  return {
    min: whole(quantity.min),
    ...(quantity.max ? { max: whole(quantity.max) } : {}),
  }
}

/**
 * Calculate a selection preview while keeping the recipe's source quantity
 * untouched. Missing or unparseable quantities remain readable without an
 * invented amount. Count suggestions are separate practical guidance.
 */
export function calculateScaledIngredients(
  ingredients: readonly RecipeIngredient[],
  scaleFactor: DecimalString,
): ScaledIngredient[] {
  return ingredients.map((ingredient) => {
    const sourceQuantity = ingredient.quantity ?? null
    const parsedQuantity = sourceQuantity
      ? parseIngredientQuantity(sourceQuantity)
      : null
    const calculatedQuantity = parsedQuantity
      ? scaleIngredientQuantity(parsedQuantity, scaleFactor)
      : null
    const parsedLine = parsedQuantity
      ? parseIngredientLine(
          `${sourceQuantity} ${ingredient.unit ?? ''} ${ingredient.ingredientName}`,
        )
      : null
    const suggestedShoppingQuantity =
      calculatedQuantity && parsedLine?.unit.dimension === 'count'
        ? suggestWholeQuantity(calculatedQuantity)
        : null

    return {
      originalText: ingredient.originalText,
      ingredientName: ingredient.ingredientName,
      ...(ingredient.unit ? { unit: ingredient.unit } : {}),
      ...(ingredient.preparationNote
        ? { preparationNote: ingredient.preparationNote }
        : {}),
      optional: ingredient.optional,
      sourceQuantity,
      calculatedQuantity,
      suggestedShoppingQuantity,
    }
  })
}
