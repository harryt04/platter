import type { RecipeIngredient, RecipeInstruction } from '@/lib/recipes/drafts'
import { parseIngredientLine } from '@/lib/recipes/ingredient-parser'

export type RecipeImportCandidate = {
  title?: string
  typicalPeopleFed?: number
  ingredients: RecipeIngredient[]
  instructions: RecipeInstruction[]
  prepTimeMinutes?: number
  cookingTimeMinutes?: number
  totalTimeMinutes?: number
  cuisine?: string
  mealType?: string
  tags?: string[]
  dietaryLabels?: string[]
  sourceName?: string
  sourceUrl: string
  sourceAuthor?: string
  attribution?: string
  warnings: string[]
}

type JsonLdObject = Record<string, unknown>

const textLimits = {
  title: 200,
  ingredient: 500,
  instruction: 2000,
  metadata: 200,
  attribution: 1000,
} as const

function cleanText(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<\s*(script|style|iframe|object|embed|template|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ' ',
    )
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = cleanText(String(value))
  return text && text.length <= maxLength ? text : undefined
}

function textValue(value: unknown, maxLength: number = textLimits.metadata) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textValue(item, maxLength)
      if (text) return text
    }
    return undefined
  }
  if (typeof value === 'object' && value !== null) {
    const object = value as JsonLdObject
    return textValue(object.name ?? object.text, maxLength)
  }
  return boundedText(value, maxLength)
}

function textValues(value: unknown, maxLength: number) {
  const values = Array.isArray(value) ? value : [value]
  return values.flatMap((item) => {
    const text = textValue(item, maxLength)
    return text ? [text] : []
  })
}

function typeIncludesRecipe(value: unknown) {
  return (Array.isArray(value) ? value : [value]).some(
    (type) =>
      typeof type === 'string' &&
      (type === 'Recipe' || type.endsWith('/Recipe')),
  )
}

function findRecipe(value: unknown): JsonLdObject | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const recipe = findRecipe(item)
      if (recipe) return recipe
    }
    return undefined
  }
  if (typeof value !== 'object' || value === null) return undefined
  const object = value as JsonLdObject
  if (typeIncludesRecipe(object['@type'])) return object

  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage']) {
    const recipe = findRecipe(object[key])
    if (recipe) return recipe
  }
  return undefined
}

function jsonLdBlocks(html: string) {
  const blocks: string[] = []
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
  for (const match of html.matchAll(scriptPattern)) {
    const attributes = match[1] ?? ''
    const typeMatch = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
      attributes,
    )
    const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '')
      .trim()
      .toLowerCase()
    if (type === 'application/ld+json') blocks.push(match[2] ?? '')
  }
  return blocks
}

function parseJsonLd(block: string) {
  const source = block.trim().replace(/^<!--/, '').replace(/-->$/, '').trim()
  if (!source) return undefined
  try {
    return JSON.parse(source) as unknown
  } catch {
    return undefined
  }
}

function parseYield(value: unknown) {
  const text = textValue(value, 100)
  if (!text) return undefined
  const numbers = text.match(/\d+(?:\.\d+)?/g) ?? []
  if (numbers.length !== 1) return undefined
  const people = Number(numbers[0])
  return Number.isInteger(people) && people > 0 && people <= 1000
    ? people
    : undefined
}

function parseDuration(value: unknown) {
  const duration = textValue(value, 50)
  if (!duration) return undefined
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      duration,
    )
  if (!match) return undefined
  const minutes =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0) +
    Number(match[4] ?? 0) / 60
  const rounded = Math.round(minutes)
  return Number.isInteger(rounded) && rounded >= 0 && rounded <= 10080
    ? rounded
    : undefined
}

function parseKeywords(value: unknown) {
  return textValues(value, 100)
    .flatMap((value) => value.split(','))
    .map((value) => cleanText(value))
    .filter((value) => value.length > 0 && value.length <= 50)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 20)
}

function parseDietaryLabels(value: unknown) {
  return textValues(value, 100)
    .map((value) => value.split('/').at(-1) ?? value)
    .map((value) =>
      value.replace(/Diet$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
    )
    .map((value) => cleanText(value))
    .filter((value) => value.length > 0 && value.length <= 50)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 20)
}

function instructionTexts(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(instructionTexts)
  if (typeof value === 'string' || typeof value === 'number') {
    const text = boundedText(value, textLimits.instruction)
    return text ? [text] : []
  }
  if (typeof value !== 'object' || value === null) return []
  const object = value as JsonLdObject
  if (Array.isArray(object.itemListElement)) {
    return object.itemListElement.flatMap(instructionTexts)
  }
  const text = boundedText(object.text ?? object.name, textLimits.instruction)
  return text ? [text] : []
}

function ingredientFromLine(line: string): RecipeIngredient {
  const parsed = parseIngredientLine(line)
  return {
    originalText: parsed.originalText,
    ...(parsed.quantity
      ? {
          quantity: parsed.quantity.max
            ? `${parsed.quantity.min}-${parsed.quantity.max}`
            : parsed.quantity.min,
        }
      : {}),
    ...(parsed.unit.name === 'unknown' ? {} : { unit: parsed.unit.name }),
    ingredientName: parsed.ingredientName,
    ...(parsed.normalizedIdentity
      ? { normalizedIdentity: parsed.normalizedIdentity }
      : {}),
    parserConfidence: parsed.parserConfidence,
    ...(parsed.preparationNote
      ? { preparationNote: parsed.preparationNote }
      : {}),
    optional: parsed.optional,
  }
}

function sourceNameFromUrl(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, '')
  } catch {
    return undefined
  }
}

/**
 * Extract only Schema.org Recipe facts from a bounded fetched HTML body.
 * JSON-LD is parsed as data; no source markup is executed or rendered. Text
 * values are stripped of markup before they enter the normalized candidate.
 */
export function extractSchemaOrgRecipe(
  html: string,
  sourceUrl: string,
): RecipeImportCandidate | null {
  const recipe = jsonLdBlocks(html)
    .map(parseJsonLd)
    .map(findRecipe)
    .find((value): value is JsonLdObject => value !== undefined)
  if (!recipe) return null

  const ingredientLines = textValues(
    recipe.recipeIngredient,
    textLimits.ingredient,
  )
  const instructions = instructionTexts(recipe.recipeInstructions)
  const sourceName =
    textValue(recipe.publisher, textLimits.metadata) ??
    sourceNameFromUrl(sourceUrl)
  const sourceAuthor = textValue(recipe.author, textLimits.metadata)
  const attribution = textValue(
    recipe.citation ?? recipe.creditText ?? recipe.copyrightNotice,
    textLimits.attribution,
  )

  const candidate: RecipeImportCandidate = {
    ...(boundedText(recipe.name, textLimits.title)
      ? { title: boundedText(recipe.name, textLimits.title) }
      : {}),
    ...(parseYield(recipe.recipeYield) !== undefined
      ? { typicalPeopleFed: parseYield(recipe.recipeYield) }
      : {}),
    ingredients: ingredientLines.map(ingredientFromLine),
    instructions,
    ...(parseDuration(recipe.prepTime) !== undefined
      ? { prepTimeMinutes: parseDuration(recipe.prepTime) }
      : {}),
    ...(parseDuration(recipe.cookTime) !== undefined
      ? { cookingTimeMinutes: parseDuration(recipe.cookTime) }
      : {}),
    ...(parseDuration(recipe.totalTime) !== undefined
      ? { totalTimeMinutes: parseDuration(recipe.totalTime) }
      : {}),
    ...(textValue(recipe.recipeCuisine)
      ? { cuisine: textValue(recipe.recipeCuisine) }
      : {}),
    ...(textValue(recipe.recipeCategory)
      ? { mealType: textValue(recipe.recipeCategory) }
      : {}),
    ...(parseKeywords(recipe.keywords).length
      ? { tags: parseKeywords(recipe.keywords) }
      : {}),
    ...(parseDietaryLabels(recipe.suitableForDiet).length
      ? { dietaryLabels: parseDietaryLabels(recipe.suitableForDiet) }
      : {}),
    ...(sourceName ? { sourceName } : {}),
    sourceUrl,
    ...(sourceAuthor ? { sourceAuthor } : {}),
    ...(attribution ? { attribution } : {}),
    warnings: [],
  }

  if (!candidate.title)
    candidate.warnings.push('The source did not provide a usable title.')
  if (!candidate.typicalPeopleFed) {
    candidate.warnings.push(
      'The source did not provide a single whole-number yield.',
    )
  }
  if (candidate.ingredients.length === 0) {
    candidate.warnings.push(
      'The source did not provide structured ingredients.',
    )
  }
  if (candidate.instructions.length === 0) {
    candidate.warnings.push(
      'The source did not provide structured instructions.',
    )
  }
  return candidate
}
