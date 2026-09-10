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
  convertIngredientQuantity,
} from '@/lib/recipes/ingredient-parser'
import type { RecipeSelectionDocument } from '@/lib/recipes/selections'
import { scaleIngredientQuantity } from '@/lib/recipes/scaling'
import {
  defaultGroceryCategory,
  type GroceryCategory,
} from '@/lib/recipes/grocery-categories'

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
  /** The calculated requirement the shopper saw when choosing the override. */
  calculatedRequirementAtOverride?: ParsedIngredientQuantity
  /**
   * The stable identity facts needed to keep an intentional shopping amount
   * visible after its final recipe contribution is removed. The current
   * calculated requirement is intentionally regenerated as null because no
   * recipe or manual contribution remains to support it.
   */
  preservedItem?: Pick<
    GroceryItem,
    'ingredientName' | 'normalizedIdentity' | 'dimension' | 'unit'
  > & { category?: GroceryCategory }
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
  packageSize?: NonNullable<ParsedIngredientLine['packageSize']>
  preparationNote?: string
  optional: boolean
  calculatedQuantity: ParsedIngredientQuantity | null
}

export type GroceryPurchaseSuggestion = {
  kind: 'whole-unit'
  quantity: ParsedIngredientQuantity
}

export type GroceryItem = {
  /** Stable for an equivalent generation input; it is not a random document id. */
  id: string
  ingredientName: string
  category: GroceryCategory
  normalizedIdentity?: string
  dimension: IngredientDimension
  unit: ParsedIngredientUnit
  calculatedRequirement: ParsedIngredientQuantity | null
  shoppingAmount: ParsedIngredientQuantity | null
  /** Optional editable guidance; it is never applied without user action. */
  suggestedShoppingAmount?: GroceryPurchaseSuggestion
  override?: ParsedIngredientQuantity
  overrideWarning?: {
    previousCalculatedRequirement: ParsedIngredientQuantity
    currentCalculatedRequirement: ParsedIngredientQuantity | null
  }
  contributions: GroceryContribution[]
}

/**
 * A possible low-confidence match is advisory only. The two grocery items
 * remain separate until a later correction flow explicitly accepts a merge.
 */
export type GroceryMergeSuggestion = {
  id: string
  left: GroceryItem
  right: GroceryItem
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
  const sourceParsed = parseIngredientLine(ingredient.originalText)
  const packageSize =
    sourceParsed.packageSize &&
    sourceParsed.ingredientName === parsed.ingredientName &&
    sourceParsed.unit.name === parsed.unit.name
      ? sourceParsed.packageSize
      : undefined
  const normalizedIdentity =
    ingredient.normalizedIdentity ?? parsed.normalizedIdentity
  const parserConfidence =
    ingredient.parserConfidence ?? parsed.parserConfidence
  const normalizedParsed = {
    ...parsed,
    ...(packageSize ? { packageSize } : {}),
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

function compatibleIdentity(prepared: PreparedIngredient) {
  if (!canMerge(prepared)) return null
  if (
    prepared.parsed.unit.dimension !== 'mass' &&
    prepared.parsed.unit.dimension !== 'volume'
  ) {
    return null
  }
  return [
    prepared.parsed.normalizedIdentity,
    prepared.parsed.unit.dimension,
  ].join(':')
}

function suggestionIdentity(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

  return normalized || null
}

function convertForUnit(
  quantity: ParsedIngredientQuantity | null,
  fromUnit: ParsedIngredientUnit,
  toUnit: ParsedIngredientUnit,
) {
  if (!quantity) return null
  return convertIngredientQuantity(quantity, fromUnit, toUnit)
}

function quantitiesEqual(
  left: ParsedIngredientQuantity | null | undefined,
  right: ParsedIngredientQuantity | null,
) {
  if (!left || !right) return left === right
  return (
    new CalculationDecimal(left.min).eq(right.min) &&
    (left.max === undefined
      ? right.max === undefined
      : right.max !== undefined &&
        new CalculationDecimal(left.max).eq(right.max))
  )
}

function applyOverride(
  item: GroceryItem,
  override: GroceryAmountOverride,
): GroceryItem {
  const changedSinceOverride =
    override.calculatedRequirementAtOverride !== undefined &&
    !quantitiesEqual(
      override.calculatedRequirementAtOverride,
      item.calculatedRequirement,
    )

  return {
    ...item,
    shoppingAmount: override.quantity,
    override: override.quantity,
    ...(changedSinceOverride
      ? {
          overrideWarning: {
            previousCalculatedRequirement:
              override.calculatedRequirementAtOverride!,
            currentCalculatedRequirement: item.calculatedRequirement,
          },
        }
      : {}),
  }
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
    ...(prepared.parsed.packageSize
      ? { packageSize: prepared.parsed.packageSize }
      : {}),
    ...(prepared.parsed.preparationNote
      ? { preparationNote: prepared.parsed.preparationNote }
      : {}),
    optional: ingredient.optional,
    calculatedQuantity: prepared.calculatedQuantity,
  }
}

function ceilQuantity(
  quantity: ParsedIngredientQuantity,
): ParsedIngredientQuantity {
  const ceil = (value: string) =>
    decimalString(new CalculationDecimal(value).ceil().toString())

  return {
    min: ceil(quantity.min),
    ...(quantity.max ? { max: ceil(quantity.max) } : {}),
  }
}

function wholeUnitSuggestion(
  item: GroceryItem,
): GroceryPurchaseSuggestion | undefined {
  if (!item.calculatedRequirement || item.dimension !== 'count')
    return undefined

  const quantity = ceilQuantity(item.calculatedRequirement)
  if (quantitiesEqual(quantity, item.calculatedRequirement)) return undefined

  return { kind: 'whole-unit', quantity }
}

function addPurchaseSuggestion(item: GroceryItem): GroceryItem {
  const suggestion = wholeUnitSuggestion(item)
  return suggestion ? { ...item, suggestedShoppingAmount: suggestion } : item
}

function itemFromContribution(
  itemId: string,
  contribution: GroceryContribution,
): GroceryItem {
  return {
    id: itemId,
    ingredientName: contribution.ingredientName,
    category: defaultGroceryCategory({
      ingredientName: contribution.ingredientName,
      normalizedIdentity: contribution.normalizedIdentity,
      originalTexts: [contribution.originalText],
      parserConfidence: contribution.parserConfidence,
    }),
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
 * Only high-confidence, same-dimension facts are merged here. Mass and volume
 * contributions use the first contribution's unit as their common calculation
 * unit; the original contribution quantity and unit remain available for
 * provenance and readable breakdowns.
 */
export function generateGroceryItems({
  selections,
  manualAdditions = [],
  overrides = [],
  splitContributionIds = [],
}: {
  selections: readonly GroceryRecipeSelection[]
  manualAdditions?: readonly GroceryManualAddition[]
  overrides?: readonly GroceryAmountOverride[]
  splitContributionIds?: readonly string[]
}): GroceryItem[] {
  const items = new Map<string, GroceryItem>()
  const splitIds = new Set(splitContributionIds)

  const addContribution = (
    contribution: GroceryContribution,
    prepared: PreparedIngredient,
    fallbackKey: string,
  ) => {
    const isSplit = splitIds.has(contribution.id)
    const itemKey = isSplit ? null : mergeKey(prepared)
    const compatibleKey = isSplit ? null : compatibleIdentity(prepared)
    let itemId = isSplit
      ? `grocery:split:${contribution.id}`
      : `grocery:${itemKey ?? fallbackKey}`
    let existing = items.get(itemId)

    if (!existing && compatibleKey) {
      existing = [...items.values()].find(
        (item) =>
          !item.id.startsWith('grocery:split:') &&
          [item.normalizedIdentity, item.dimension].join(':') === compatibleKey,
      )
      if (existing) itemId = existing.id
    }

    if (!existing) {
      items.set(itemId, itemFromContribution(itemId, contribution))
      return
    }

    const convertedQuantity = convertForUnit(
      contribution.calculatedQuantity,
      contribution.unit,
      existing.unit,
    )
    if (!convertedQuantity) {
      const separateId = `${itemId}:separate:${prepared.parsed.unit.name}`
      items.set(separateId, itemFromContribution(separateId, contribution))
      return
    }

    existing.contributions.push(contribution)
    if (existing.calculatedRequirement && convertedQuantity) {
      existing.calculatedRequirement = addQuantities(
        existing.calculatedRequirement,
        convertedQuantity,
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
    overrides.map((override) => [override.itemId, override]),
  )

  const generatedItems = [...items.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => {
      const override = overridesByItemId.get(item.id)
      if (!override) return item
      return applyOverride(item, override)
    })
    .concat(
      overrides.flatMap((override) => {
        if (items.has(override.itemId) || !override.preservedItem) return []
        return [
          applyOverride(
            {
              id: override.itemId,
              ...override.preservedItem,
              category:
                override.preservedItem.category ??
                defaultGroceryCategory({
                  ingredientName: override.preservedItem.ingredientName,
                  normalizedIdentity: override.preservedItem.normalizedIdentity,
                }),
              calculatedRequirement: null,
              shoppingAmount: override.quantity,
              contributions: [],
            },
            override,
          ),
        ]
      }),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => ({
      ...item,
      contributions: [...item.contributions].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }))

  return generatedItems.map(addPurchaseSuggestion)
}

/**
 * Find conservative, deterministic suggestions for items that were kept
 * separate because their only contribution parsed with low confidence.
 * Suggestions require the same visible ingredient identity and dimension;
 * they never merge items or infer a conversion.
 */
export function findGroceryMergeSuggestions(
  items: readonly GroceryItem[],
): GroceryMergeSuggestion[] {
  const candidates = items
    .filter(
      (item) =>
        item.contributions.length === 1 &&
        item.contributions[0]?.parserConfidence === 'low',
    )
    .map((item) => ({
      item,
      identity:
        item.normalizedIdentity ?? suggestionIdentity(item.ingredientName),
    }))
    .filter(
      (candidate): candidate is typeof candidate & { identity: string } =>
        candidate.identity !== null,
    )
    .sort((left, right) => left.item.id.localeCompare(right.item.id))

  const grouped = new Map<string, typeof candidates>()
  for (const candidate of candidates) {
    const key = `${candidate.identity}:${candidate.item.dimension}`
    const group = grouped.get(key) ?? []
    group.push(candidate)
    grouped.set(key, group)
  }

  return [...grouped.values()]
    .flatMap((group) =>
      group.slice(0, -1).flatMap((left, index) =>
        group.slice(index + 1).map((right) => ({
          id: `grocery-merge-suggestion:${left.item.id}:${right.item.id}`,
          left: left.item,
          right: right.item,
        })),
      ),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
}
