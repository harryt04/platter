import Decimal from 'decimal.js'

const CalculationDecimal = Decimal.clone({ precision: 40 })

export type IngredientDimension = 'count' | 'mass' | 'volume' | 'unknown'

export type ParsedIngredientUnit = {
  name: string
  dimension: IngredientDimension
}

export type ParsedIngredientQuantity = {
  min: string
  max?: string
}

export type IngredientParserConfidence = 'high' | 'medium' | 'low'

export type ParsedIngredientLine = {
  originalText: string
  quantity: ParsedIngredientQuantity | null
  unit: ParsedIngredientUnit
  ingredientName: string
  normalizedIdentity?: string
  parserConfidence: IngredientParserConfidence
  preparationNote?: string
  optional: boolean
  packageSize?: {
    quantity: ParsedIngredientQuantity
    unit: ParsedIngredientUnit
  }
}

export type ParseIngredientOptions = {
  locale?: string
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
const defaultLocale = 'en-US'

function decimalSeparators(locale: string) {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1000.1)
    const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.'
    const group = parts.find((part) => part.type === 'group')?.value
    return { decimal, group }
  } catch {
    return { decimal: '.', group: undefined }
  }
}

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function quantityAtomPattern(locale: string) {
  const { decimal } = decimalSeparators(locale)
  const decimalPattern = escapedPattern(decimal)
  return String.raw`(?:\d+(?:${decimalPattern}\d+)?(?:\s+\d+\s*/\s*\d+|\s*[${fractionCharacterPattern}])?|\d+\s*/\s*\d+|[${fractionCharacterPattern}])`
}

function quantityPrefixPattern(locale: string) {
  const atom = quantityAtomPattern(locale)
  return new RegExp(
    String.raw`^(${atom})(?:\s*(?:-|–|—|to)\s*(${atom}))?(?=\s|$)`,
    'i',
  )
}

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

function normalizeIngredientIdentity(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

  return normalized || undefined
}

const ingredientAliases: Record<string, string> = {
  aubergine: 'eggplant',
  aubergines: 'eggplant',
  eggplant: 'eggplant',
  eggplants: 'eggplant',
  'bicarbonate of soda': 'baking soda',
  'confectioners sugar': 'powdered sugar',
  'icing sugar': 'powdered sugar',
  'powdered sugar': 'powdered sugar',
  courgette: 'zucchini',
  courgettes: 'zucchini',
  zucchini: 'zucchini',
  'garbanzo bean': 'chickpeas',
  'garbanzo beans': 'chickpeas',
  chickpea: 'chickpeas',
  chickpeas: 'chickpeas',
  scallion: 'green onions',
  scallions: 'green onions',
  'spring onion': 'green onions',
  'spring onions': 'green onions',
  'green onion': 'green onions',
  'green onions': 'green onions',
}

function resolveIngredientAlias(value: string) {
  const normalized = normalizeIngredientIdentity(value)
  return normalized ? (ingredientAliases[normalized] ?? normalized) : undefined
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

function parseQuantity(
  value: string,
  locale = defaultLocale,
): ParsedIngredientQuantity | null {
  try {
    const { decimal, group } = decimalSeparators(locale)
    const localized = value
      .replaceAll(group ?? '\u0000', '')
      .replace(decimal, '.')
    const parsed = parseDecimal(localized)
    if (!parsed.isFinite()) return null
    return { min: decimalString(parsed) }
  } catch {
    return null
  }
}

/** Parse an editable quantity without applying any display rounding. */
export function parseIngredientQuantity(
  value: string,
  options: ParseIngredientOptions = {},
): ParsedIngredientQuantity | null {
  return parseQuantity(cleanText(value), options.locale ?? defaultLocale)
}

function parseRange(
  min: string,
  max?: string,
  locale = defaultLocale,
): ParsedIngredientQuantity | null {
  const quantity = parseQuantity(min, locale)
  if (!max) return quantity
  const maximum = parseQuantity(max, locale)
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

function parsePackageSize(value: string, locale = defaultLocale) {
  const atom = quantityAtomPattern(locale)
  const match = new RegExp(
    String.raw`^\(\s*(${atom})\s*-?\s*([^)]*?)\s*\)\s*`,
    'i',
  ).exec(value)
  if (!match) return { packageSize: undefined, remainder: value }

  const parsedUnit = parseUnitPrefix(match[2].trim())
  const quantity = parseRange(match[1], undefined, locale)
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

function parseInlinePackageSize(value: string, locale = defaultLocale) {
  const atom = quantityAtomPattern(locale)
  const match = new RegExp(String.raw`^(${atom})\s*-?\s*`, 'i').exec(value)
  if (!match) return { packageSize: undefined, remainder: value }

  const parsedUnit = parseUnitPrefix(value.slice(match[0].length))
  const quantity = parseRange(match[1], undefined, locale)
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
export function parseIngredientLine(
  line: string,
  options: ParseIngredientOptions = {},
): ParsedIngredientLine {
  const locale = options.locale ?? defaultLocale
  const originalText = cleanText(line)
  let remainder = originalText
  let quantity: ParsedIngredientQuantity | null = null

  const quantityMatch = quantityPrefixPattern(locale).exec(remainder)
  if (quantityMatch) {
    const parsedQuantity = parseRange(
      quantityMatch[1],
      quantityMatch[2],
      locale,
    )
    if (parsedQuantity) {
      quantity = parsedQuantity
      remainder = remainder.slice(quantityMatch[0].length).trimStart()
    }
  }

  let packageSize: ParsedIngredientLine['packageSize']
  const parenthesizedPackage = parsePackageSize(remainder, locale)
  packageSize = parenthesizedPackage.packageSize
  remainder = parenthesizedPackage.remainder

  if (!packageSize && quantity) {
    const inlinePackage = parseInlinePackageSize(remainder, locale)
    packageSize = inlinePackage.packageSize
    remainder = inlinePackage.remainder
  }

  if (/^x\s/i.test(remainder)) {
    const packageMatch = new RegExp(
      String.raw`^x\s+(${quantityAtomPattern(locale)})\s*-?\s*`,
      'i',
    ).exec(remainder)
    if (packageMatch) {
      const parsedUnit = parseUnitPrefix(
        remainder.slice(packageMatch[0].length),
      )
      const packageQuantity = parseRange(packageMatch[1], undefined, locale)
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
    const trailingPackage = parsePackageSize(remainder, locale)
    packageSize = trailingPackage.packageSize
    remainder = trailingPackage.remainder
  }

  const extracted = extractPreparation(remainder)
  const parsedIngredientName = extracted.remainder.toLowerCase()
  const parsingFailed = parsedIngredientName.length === 0
  const ingredientName = parsingFailed ? originalText : parsedIngredientName
  const parserConfidence: IngredientParserConfidence =
    parsingFailed || (quantityMatch !== null && quantity === null)
      ? 'low'
      : quantity && parsedUnit.unit
        ? 'high'
        : quantity
          ? 'medium'
          : 'low'
  const normalizedIdentity =
    parserConfidence === 'low' || parsingFailed
      ? undefined
      : resolveIngredientAlias(ingredientName)

  if (parsingFailed) {
    return {
      originalText,
      quantity: null,
      unit: unknownUnit,
      ingredientName,
      parserConfidence,
      ...(extracted.preparationNote
        ? { preparationNote: extracted.preparationNote }
        : {}),
      optional: extracted.optional,
    }
  }

  return {
    originalText,
    quantity,
    unit,
    ingredientName,
    ...(normalizedIdentity ? { normalizedIdentity } : {}),
    parserConfidence,
    ...(extracted.preparationNote
      ? { preparationNote: extracted.preparationNote }
      : {}),
    optional: extracted.optional,
    ...(packageSize ? { packageSize } : {}),
  }
}

type MeasurementSystem = 'metric' | 'imperial-us' | 'imperial-uk'

function measurementSystem(locale: string): MeasurementSystem {
  let region: string | undefined
  try {
    region = new Intl.Locale(locale).region
  } catch {
    region = undefined
  }

  if (region === 'GB') return 'imperial-uk'
  if (region === 'US' || region === 'LR' || region === 'MM') {
    return 'imperial-us'
  }
  return 'metric'
}

const massFactorsInGrams: Record<string, string> = {
  g: '1',
  kg: '1000',
  oz: '28.349523125',
  lb: '453.59237',
}

const volumeFactorsInMilliliters: Record<
  MeasurementSystem,
  Record<string, string>
> = {
  metric: {
    ml: '1',
    l: '1000',
    tsp: '5',
    tbsp: '15',
    cup: '250',
    pint: '500',
    quart: '1000',
    gallon: '4000',
    'fl oz': '30',
  },
  'imperial-us': {
    ml: '1',
    l: '1000',
    tsp: '4.92892159375',
    tbsp: '14.78676478125',
    cup: '236.5882365',
    pint: '473.176473',
    quart: '946.352946',
    gallon: '3785.411784',
    'fl oz': '29.5735295625',
  },
  'imperial-uk': {
    ml: '1',
    l: '1000',
    tsp: '5.9193880208333333333',
    tbsp: '17.7581640625',
    cup: '284.130625',
    pint: '568.26125',
    quart: '1136.5225',
    gallon: '4546.09',
    'fl oz': '28.4130625',
  },
}

function conversionFactor(unit: ParsedIngredientUnit, locale: string) {
  if (unit.dimension === 'mass') return massFactorsInGrams[unit.name]
  if (unit.dimension === 'volume') {
    return volumeFactorsInMilliliters[measurementSystem(locale)][unit.name]
  }
  return undefined
}

/**
 * Convert a parsed quantity without display rounding. Incompatible dimensions,
 * unknown units, and non-equivalent count units intentionally return null.
 */
export function convertIngredientQuantity(
  quantity: ParsedIngredientQuantity,
  fromUnit: ParsedIngredientUnit,
  toUnit: ParsedIngredientUnit,
  locale = defaultLocale,
): ParsedIngredientQuantity | null {
  if (fromUnit.dimension !== toUnit.dimension) return null

  if (fromUnit.dimension === 'count' || fromUnit.dimension === 'unknown') {
    return fromUnit.name === toUnit.name ? quantity : null
  }

  const fromFactor = conversionFactor(fromUnit, locale)
  const toFactor = conversionFactor(toUnit, locale)
  if (!fromFactor || !toFactor) return null

  const convert = (value: string) =>
    new CalculationDecimal(value)
      .times(fromFactor)
      .dividedBy(toFactor)
      .toString()

  return {
    min: convert(quantity.min),
    ...(quantity.max ? { max: convert(quantity.max) } : {}),
  }
}
