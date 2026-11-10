import {
  convertIngredientQuantity,
  parseIngredientLine,
  type IngredientDimension,
  type ParsedIngredientQuantity,
  type ParsedIngredientUnit,
} from '@/lib/recipes/ingredient-parser'

type PresentationUnitName =
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'pint'
  | 'fl oz'

type MeasurementSystem = 'metric' | 'imperial-us' | 'imperial-uk'

const unitDimensions: Record<PresentationUnitName, IngredientDimension> = {
  g: 'mass',
  kg: 'mass',
  oz: 'mass',
  lb: 'mass',
  ml: 'volume',
  l: 'volume',
  tsp: 'volume',
  tbsp: 'volume',
  cup: 'volume',
  pint: 'volume',
  'fl oz': 'volume',
}

function measurementSystem(locale: string): MeasurementSystem {
  try {
    const region = new Intl.Locale(locale).region
    if (region === 'GB') return 'imperial-uk'
    if (region === 'US' || region === 'LR' || region === 'MM') {
      return 'imperial-us'
    }
  } catch {
    // Use the safe metric default for an invalid locale.
  }
  return 'metric'
}

function unit(name: PresentationUnitName): ParsedIngredientUnit {
  return { name, dimension: unitDimensions[name] }
}

function baseQuantity(
  quantity: ParsedIngredientQuantity,
  sourceUnit: ParsedIngredientUnit,
  locale: string,
) {
  const baseUnit = sourceUnit.dimension === 'mass' ? unit('g') : unit('ml')
  return convertIngredientQuantity(quantity, sourceUnit, baseUnit, locale)
}

function largestQuantity(quantity: ParsedIngredientQuantity) {
  const values = [quantity.min, quantity.max].filter(Boolean).map(Number)
  const largest = Math.max(...values)
  return Number.isFinite(largest) ? largest : 0
}

function preferredUnit(
  quantity: ParsedIngredientQuantity,
  sourceUnit: ParsedIngredientUnit,
  locale: string,
): ParsedIngredientUnit {
  if (sourceUnit.dimension !== 'mass' && sourceUnit.dimension !== 'volume') {
    return sourceUnit
  }

  const base = baseQuantity(quantity, sourceUnit, locale)
  if (!base) return sourceUnit
  const amount = largestQuantity(base)
  const system = measurementSystem(locale)

  if (sourceUnit.dimension === 'mass') {
    if (system === 'metric') return amount >= 1000 ? unit('kg') : unit('g')
    return amount >= 453.59237 ? unit('lb') : unit('oz')
  }

  if (system === 'metric') return amount >= 1000 ? unit('l') : unit('ml')
  if (system === 'imperial-uk') {
    if (amount >= 568.26125) return unit('pint')
    return unit('fl oz')
  }
  if (amount >= 236.5882365) return unit('cup')
  if (amount >= 14.78676478125) return unit('tbsp')
  return unit('tsp')
}

function formatNumber(
  value: string,
  locale: string,
  preservePrecision = false,
) {
  const number = Number(value)
  if (!Number.isFinite(number)) return value
  if (preservePrecision && locale === 'en-US') return value
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    number,
  )
}

/** Format a quantity for display without changing stored calculation values. */
export function formatIngredientQuantity(
  quantity: ParsedIngredientQuantity | null | undefined,
  sourceUnit: ParsedIngredientUnit,
  locale = 'en-US',
) {
  if (!quantity) return 'As needed'
  const targetUnit = preferredUnit(quantity, sourceUnit, locale)
  const converted =
    targetUnit.name === sourceUnit.name
      ? quantity
      : convertIngredientQuantity(quantity, sourceUnit, targetUnit, locale)
  const displayQuantity = converted ?? quantity
  const preservePrecision = targetUnit.name === sourceUnit.name
  const amount = displayQuantity.max
    ? `${formatNumber(displayQuantity.min, locale, preservePrecision)}–${formatNumber(displayQuantity.max, locale, preservePrecision)}`
    : formatNumber(displayQuantity.min, locale, preservePrecision)
  return targetUnit.name ? `${amount} ${targetUnit.name}` : amount
}

export function ingredientUnitForDisplay(unitName?: string) {
  if (!unitName) return { name: 'unknown', dimension: 'unknown' as const }
  return parseIngredientLine(`1 ${unitName} ingredient`).unit
}
