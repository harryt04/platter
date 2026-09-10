import Decimal from 'decimal.js'
import { decimalString, type DecimalString } from '@/lib/contracts/ids'
import type {
  RecipeIngredient,
  RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import {
  parseIngredientLine,
  type IngredientDimension,
  type IngredientParserConfidence,
  type ParsedIngredientLine,
  type ParsedIngredientQuantity,
  type ParsedIngredientUnit,
} from '@/lib/recipes/ingredient-parser'
import type { RecipeSelectionDocument } from '@/lib/recipes/selections'
import { scaleIngredientQuantity } from '@/lib/recipes/scaling'

const CalculationDecimal = Decimal.clone({ precision: 40 })

export type GroceryRecipeSelection = {
  selection: Pick<
    RecipeSelectionDocument,
    '_id' | 'recipeId' | 'versionId' | 'scaleFactor'
  >
  version: Pick<
    RecipeVersionDocument,
    '_id' | 'recipeId' | 'versionNumber' | 'title' | 'ingredients'
  >
}

/** A manual addition has the same normalized ingredient facts as a recipe line. */
export type GroceryManualAddition = {
  id: string
  ingredient: RecipeIngredient
}

export type GroceryAmountOverride = {
  itemId: string
  quantity: ParsedIngredientQuantity
}

export type GroceryContribution = {
  id: string
  source:
    | {
        kind: 'recipe'
        selectionId: string
        recipeId: string
        versionId: string
        recipeTitle: string
      }
    | { kind: 'manual'; additionId: string }
  originalText: string
  ingredientName: string
  normalizedIdentity?: string
  parserConfidence: IngredientParserConfidence
  unit: ParsedIngredientUnit
  preparationNote?: string
  optional: boolean
  calculatedQuantity: ParsedIngredientQuantity | null
}

export type GroceryItem = {
  /** Stable for an equivalent generation input; it is not a random document id. */
  id: string
  ingredientName: string
  normalizedIdentity?: string
  dimension: IngredientDimension
  unit: ParsedIngredientUnit
  calculatedRequirement: ParsedIngredientQuantity | null
  shoppingAmount: ParsedIngredientQuantity | null
  override?: ParsedIngredientQuantity
  contributions: GroceryContribution[]
}

type PreparedIngredient = {
  parsed: ParsedIngredientLine
  calculatedQuantity: ParsedIngredientQuantity | null
}

function prepareIngredient(
  ingredient: RecipeIngredient,
  scaleFactor?: DecimalString,
): PreparedIngredient {
  // Structured fields are authoritative after an editor correction. Parsing
  // this assembled line retains ranges and derives the canonical unit/identity
  // without consulting the original, potentially stale source line.
  const assembledLine = [
    ingredient.quantity,
    ingredient.unit,
    ingredient.ingredientName,
  ]
    .filter((part) => part !== undefined && part.trim() !== '')
    .join(' ')
  const parsed = parseIngredientLine(assembledLine)
  const normalizedIdentity =
    ingredient.normalizedIdentity ?? parsed.normalizedIdentity
  const parserConfidence =
    ingredient.parserConfidence ?? parsed.parserConfidence
  const normalizedParsed = {
    ...parsed,
    ...(normalizedIdentity ? { normalizedIdentity } : {}),
    parserConfidence,
  }

  return {
    parsed: normalizedParsed,
    calculatedQuantity:
      parsed.quantity && scaleFactor
        ? scaleIngredientQuantity(parsed.quantity, scaleFactor)
        : parsed.quantity,
  }
}

function addQuantities(
  left: ParsedIngredientQuantity,
  right: ParsedIngredientQuantity,
): ParsedIngredientQuantity {
  const add = (first: string, second: string) =>
    decimalString(new CalculationDecimal(first).plus(second).toString())
  const leftMaximum = left.max ?? left.min
  const rightMaximum = right.max ?? right.min

  return {
    min: add(left.min, right.min),
    ...(left.max || right.max ? { max: add(leftMaximum, rightMaximum) } : {}),
  }
}

function canMerge(prepared: PreparedIngredient) {
  return Boolean(
    prepared.parsed.normalizedIdentity &&
    prepared.parsed.parserConfidence === 'high' &&
    prepared.calculatedQuantity &&
    prepared.parsed.unit.dimension !== 'unknown',
  )
}

function mergeKey(prepared: PreparedIngredient) {
  if (!canMerge(prepared)) return null
  return [
    'merged',
    prepared.parsed.normalizedIdentity,
    prepared.parsed.unit.dimension,
    prepared.parsed.unit.name,
  ].join(':')
}

function contributionFromIngredient(
  ingredient: RecipeIngredient,
  prepared: PreparedIngredient,
  source: GroceryContribution['source'],
  id: string,
): GroceryContribution {
  return {
    id,
    source,
    originalText: ingredient.originalText,
    ingredientName: prepared.parsed.ingredientName,
    ...(prepared.parsed.normalizedIdentity
      ? { normalizedIdentity: prepared.parsed.normalizedIdentity }
      : {}),
    parserConfidence: prepared.parsed.parserConfidence,
    unit: prepared.parsed.unit,
    ...(prepared.parsed.preparationNote
      ? { preparationNote: prepared.parsed.preparationNote }
      : {}),
    optional: ingredient.optional,
    calculatedQuantity: prepared.calculatedQuantity,
  }
}

function itemFromContribution(
  itemId: string,
  contribution: GroceryContribution,
): GroceryItem {
  return {
    id: itemId,
    ingredientName: contribution.ingredientName,
    ...(contribution.normalizedIdentity
      ? { normalizedIdentity: contribution.normalizedIdentity }
      : {}),
    dimension: contribution.unit.dimension,
    unit: contribution.unit,
    calculatedRequirement: contribution.calculatedQuantity,
    shoppingAmount: contribution.calculatedQuantity,
    contributions: [contribution],
  }
}

/**
 * Derive the current run's grocery items without mutating recipes or the run.
 * Only high-confidence, same-dimension, same-unit facts are merged here;
 * compatible-unit conversion and user correction flows build on this boundary.
 */
export function generateGroceryItems({
  selections,
  manualAdditions = [],
  overrides = [],
}: {
  selections: readonly GroceryRecipeSelection[]
  manualAdditions?: readonly GroceryManualAddition[]
  overrides?: readonly GroceryAmountOverride[]
}): GroceryItem[] {
  const items = new Map<string, GroceryItem>()

  const addContribution = (
    contribution: GroceryContribution,
    prepared: PreparedIngredient,
    fallbackKey: string,
  ) => {
    const itemKey = mergeKey(prepared) ?? fallbackKey
    const itemId = `grocery:${itemKey}`
    const existing = items.get(itemId)

    if (!existing) {
      items.set(itemId, itemFromContribution(itemId, contribution))
      return
    }

    existing.contributions.push(contribution)
    if (existing.calculatedRequirement && contribution.calculatedQuantity) {
      existing.calculatedRequirement = addQuantities(
        existing.calculatedRequirement,
        contribution.calculatedQuantity,
      )
      existing.shoppingAmount = existing.calculatedRequirement
    } else {
      // A missing amount remains missing even when another contribution is
      // quantified; silently inventing a total would be unsafe to shop from.
      existing.calculatedRequirement = null
      existing.shoppingAmount = null
    }
  }

  for (const { selection, version } of selections) {
    version.ingredients.forEach((ingredient, ingredientIndex) => {
      const prepared = prepareIngredient(ingredient, selection.scaleFactor)
      const fallbackKey = `recipe:${selection._id}:${ingredientIndex}`
      addContribution(
        contributionFromIngredient(
          ingredient,
          prepared,
          {
            kind: 'recipe',
            selectionId: selection._id,
            recipeId: selection.recipeId,
            versionId: selection.versionId,
            recipeTitle: version.title,
          },
          fallbackKey,
        ),
        prepared,
        fallbackKey,
      )
    })
  }

  for (const addition of manualAdditions) {
    const prepared = prepareIngredient(addition.ingredient)
    const fallbackKey = `manual:${addition.id}`
    addContribution(
      contributionFromIngredient(
        addition.ingredient,
        prepared,
        { kind: 'manual', additionId: addition.id },
        fallbackKey,
      ),
      prepared,
      fallbackKey,
    )
  }

  const overridesByItemId = new Map(
    overrides.map((override) => [override.itemId, override.quantity]),
  )

  return [...items.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => {
      const override = overridesByItemId.get(item.id)
      if (!override) return item
      return { ...item, shoppingAmount: override, override }
    })
    .map((item) => ({
      ...item,
      contributions: [...item.contributions].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }))
}
