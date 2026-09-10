import Decimal from 'decimal.js'

export type IngredientDimension = 'count' | 'mass' | 'volume' | 'unknown'

export type ParsedIngredientUnit = {
  name: string
  dimension: IngredientDimension
}

export type ParsedIngredientQuantity = {
  min: string
  max?: string
}

export type ParsedIngredientLine = {
  originalText: string
  quantity: ParsedIngredientQuantity | null
  unit: ParsedIngredientUnit
  ingredientName: string
  preparationNote?: string
  optional: boolean
  packageSize?: {
    quantity: ParsedIngredientQuantity
    unit: ParsedIngredientUnit
  }
}

const unicodeFractions: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅐': '1/7',
  '⅑': '1/9',
  '⅒': '1/10',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

const fractionCharacterPattern = Object.keys(unicodeFractions).join('')
const quantityAtomPattern = String.raw`(?:\d+(?:\.\d+)?(?:\s+\d+\s*/\s*\d+|\s*[${fractionCharacterPattern}])?|\d+\s*/\s*\d+|[${fractionCharacterPattern}])`
const quantityPrefixPattern = new RegExp(
  String.raw`^(${quantityAtomPattern})(?:\s*(?:-|–|—|to)\s*(${quantityAtomPattern}))?(?=\s|$)`,
  'i',
)

const units: Record<string, ParsedIngredientUnit> = {}

function registerUnit(
  dimension: IngredientDimension,
  name: string,
  ...aliases: string[]
) {
  for (const alias of [name, ...aliases]) units[alias] = { name, dimension }
}

registerUnit('count', 'each', 'ea', 'piece', 'pieces', 'pc', 'pcs', 'whole')
registerUnit('count', 'can', 'cans', 'tin', 'tins')
registerUnit('count', 'jar', 'jars')
registerUnit('count', 'package', 'packages', 'pkg', 'pkgs', 'packet', 'packets')
registerUnit('count', 'bag', 'bags')
registerUnit('count', 'bunch', 'bunches')
registerUnit('count', 'head', 'heads')
registerUnit('count', 'clove', 'cloves')
registerUnit('count', 'slice', 'slices')
registerUnit('count', 'sprig', 'sprigs')
registerUnit('count', 'stalk', 'stalks')
registerUnit('count', 'stick', 'sticks')
registerUnit('mass', 'g', 'gram', 'grams')
registerUnit('mass', 'kg', 'kilogram', 'kilograms')
registerUnit('mass', 'oz', 'ounce', 'ounces')
registerUnit('mass', 'lb', 'lbs', 'pound', 'pounds')
registerUnit(
  'volume',
  'ml',
  'milliliter',
  'milliliters',
  'millilitre',
  'millilitres',
)
registerUnit('volume', 'l', 'liter', 'liters', 'litre', 'litres')
registerUnit('volume', 'tsp', 'teaspoon', 'teaspoons')
registerUnit('volume', 'tbsp', 'tablespoon', 'tablespoons')
registerUnit('volume', 'cup', 'cups')
registerUnit('volume', 'pint', 'pints')
registerUnit('volume', 'quart', 'quarts')
registerUnit('volume', 'gallon', 'gallons')
registerUnit('volume', 'fl oz', 'fluid ounce', 'fluid ounces')
registerUnit('unknown', 'pinch', 'pinches')
registerUnit('unknown', 'dash', 'dashes')

const unknownUnit: ParsedIngredientUnit = {
  name: 'unknown',
  dimension: 'unknown',
}

function cleanText(value: string) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDecimal(value: string) {
  const normalized = value
    .replace(
      /[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g,
      (character) => ` ${unicodeFractions[character]}`,
    )
    .trim()

  const mixedFraction = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(normalized)
  if (mixedFraction) {
    return new Decimal(mixedFraction[1]).plus(
      new Decimal(mixedFraction[2]).dividedBy(mixedFraction[3]),
    )
  }

  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(normalized)
  if (fraction) return new Decimal(fraction[1]).dividedBy(fraction[2])

  return new Decimal(normalized)
}

function decimalString(value: Decimal) {
  return value.toString()
}

function parseQuantity(value: string): ParsedIngredientQuantity | null {
  try {
    const parsed = parseDecimal(value)
    if (!parsed.isFinite()) return null
    return { min: decimalString(parsed) }
  } catch {
    return null
  }
}

function parseRange(
  min: string,
  max?: string,
): ParsedIngredientQuantity | null {
  const quantity = parseQuantity(min)
  if (!max) return quantity
  const maximum = parseQuantity(max)
  if (!quantity || !maximum) return null
  return { ...quantity, max: maximum.min }
}

function parseUnitPrefix(value: string) {
  const normalized = value.toLowerCase()
  const candidates = Object.keys(units).sort(
    (left, right) => right.length - left.length,
  )
  for (const candidate of candidates) {
    if (
      normalized === candidate ||
      normalized.startsWith(`${candidate} `) ||
      normalized.startsWith(`${candidate},`)
    ) {
      return {
        unit: units[candidate],
        remainder: value.slice(candidate.length).trimStart(),
      }
    }
  }
  return { unit: null, remainder: value }
}

function parsePackageSize(value: string) {
  const match = new RegExp(
    String.raw`^\(\s*(${quantityAtomPattern})\s*-?\s*([^)]*?)\s*\)\s*`,
    'i',
  ).exec(value)
  if (!match) return { packageSize: undefined, remainder: value }

  const parsedUnit = parseUnitPrefix(match[2].trim())
  const quantity = parseRange(match[1])
  if (!parsedUnit.unit || parsedUnit.remainder || !quantity) {
    return { packageSize: undefined, remainder: value }
  }

  return {
    packageSize: {
      quantity,
      unit: parsedUnit.unit,
    },
    remainder: value.slice(match[0].length),
  }
}

function parseInlinePackageSize(value: string) {
  const match = new RegExp(
    String.raw`^(${quantityAtomPattern})\s*-?\s*`,
    'i',
  ).exec(value)
  if (!match) return { packageSize: undefined, remainder: value }

  const parsedUnit = parseUnitPrefix(value.slice(match[0].length))
  const quantity = parseRange(match[1])
  if (!parsedUnit.unit || !quantity) {
    return { packageSize: undefined, remainder: value }
  }

  return {
    packageSize: {
      quantity,
      unit: parsedUnit.unit,
    },
    remainder: parsedUnit.remainder,
  }
}

function extractPreparation(value: string) {
  let remainder = value
  const notes: string[] = []
  let optional = false

  remainder = remainder.replace(/\[\s*optional\s*\]/gi, () => {
    optional = true
    return ''
  })
  remainder = remainder.replace(/\(\s*optional\s*\)/gi, () => {
    optional = true
    return ''
  })
  remainder = remainder.replace(/\boptional\b/gi, () => {
    optional = true
    return ''
  })

  remainder = remainder.replace(/\(([^()]*)\)/g, (_match, note: string) => {
    if (cleanText(note)) notes.push(cleanText(note))
    return ''
  })

  const commaIndex = remainder.indexOf(',')
  if (commaIndex >= 0) {
    const note = cleanText(remainder.slice(commaIndex + 1))
    if (note) notes.push(note)
    remainder = remainder.slice(0, commaIndex)
  }

  return {
    remainder: cleanText(remainder)
      .replace(/[,:;]+$/, '')
      .trim(),
    preparationNote: notes.length > 0 ? notes.join(', ') : undefined,
    optional,
  }
}

/**
 * Parse one human-authored ingredient line without discarding its source text.
 * Quantities are returned as decimal strings so later scaling does not depend
 * on display rounding or binary floating-point arithmetic.
 */
export function parseIngredientLine(line: string): ParsedIngredientLine {
  const originalText = cleanText(line)
  let remainder = originalText
  let quantity: ParsedIngredientQuantity | null = null

  const quantityMatch = quantityPrefixPattern.exec(remainder)
  if (quantityMatch) {
    const parsedQuantity = parseRange(quantityMatch[1], quantityMatch[2])
    if (parsedQuantity) {
      quantity = parsedQuantity
      remainder = remainder.slice(quantityMatch[0].length).trimStart()
    }
  }

  let packageSize: ParsedIngredientLine['packageSize']
  const parenthesizedPackage = parsePackageSize(remainder)
  packageSize = parenthesizedPackage.packageSize
  remainder = parenthesizedPackage.remainder

  if (!packageSize && quantity) {
    const inlinePackage = parseInlinePackageSize(remainder)
    packageSize = inlinePackage.packageSize
    remainder = inlinePackage.remainder
  }

  if (/^x\s/i.test(remainder)) {
    const packageMatch = new RegExp(
      String.raw`^x\s+(${quantityAtomPattern})\s*-?\s*`,
      'i',
    ).exec(remainder)
    if (packageMatch) {
      const parsedUnit = parseUnitPrefix(
        remainder.slice(packageMatch[0].length),
      )
      const packageQuantity = parseRange(packageMatch[1])
      if (parsedUnit.unit && packageQuantity) {
        packageSize = {
          quantity: packageQuantity,
          unit: parsedUnit.unit,
        }
        remainder = parsedUnit.remainder
      }
    }
  }

  const parsedUnit = parseUnitPrefix(remainder)
  const unit =
    quantity && parsedUnit.unit
      ? parsedUnit.unit
      : quantity
        ? { name: 'each', dimension: 'count' as const }
        : unknownUnit
  if (quantity && parsedUnit.unit) remainder = parsedUnit.remainder

  if (quantity && !packageSize) {
    const trailingPackage = parsePackageSize(remainder)
    packageSize = trailingPackage.packageSize
    remainder = trailingPackage.remainder
  }

  const extracted = extractPreparation(remainder)
  const ingredientName = extracted.remainder.toLowerCase()

  return {
    originalText,
    quantity,
    unit,
    ingredientName,
    ...(extracted.preparationNote
      ? { preparationNote: extracted.preparationNote }
      : {}),
    optional: extracted.optional,
    ...(packageSize ? { packageSize } : {}),
  }
}
