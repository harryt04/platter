import type { RecipeIngredient } from '@/lib/recipes/drafts'
import { parseIngredientLine } from '@/lib/recipes/ingredient-parser'
import type { RecipeImportCandidate } from '@/lib/recipe-import-schema-org'

const textLimits = {
  title: 200,
  ingredient: 500,
  instruction: 2000,
} as const

function cleanText(value: string) {
  return value
    .replace(
      /<\s*(script|style|iframe|object|embed|template|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ' ',
    )
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gi, (entity) => {
      const values: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
      }
      return values[entity.toLowerCase()] ?? entity
    })
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function attributeValue(attributes: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  ).exec(attributes)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

function bounded(value: string | undefined, maxLength: number) {
  if (!value) return undefined
  const text = cleanText(value)
  return text && text.length <= maxLength ? text : undefined
}

function itempropValues(html: string, property: string, maxLength: number) {
  const values: string[] = []
  const pairedPattern =
    /<([a-z0-9]+)\b([^>]*\bitemprop\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*)>([\s\S]*?)<\/\1\s*>/gi
  for (const match of html.matchAll(pairedPattern)) {
    const attributes = match[2] ?? ''
    const properties = attributeValue(attributes, 'itemprop')
      ?.split(/\s+/)
      .map((value) => value.toLowerCase())
    if (!properties?.includes(property.toLowerCase())) continue
    const value = bounded(match[3], maxLength)
    if (value) values.push(value)
  }

  const standalonePattern = /<(?:meta|input)\b([^>]*)>/gi
  for (const match of html.matchAll(standalonePattern)) {
    const attributes = match[1] ?? ''
    const properties = attributeValue(attributes, 'itemprop')
      ?.split(/\s+/)
      .map((value) => value.toLowerCase())
    if (!properties?.includes(property.toLowerCase())) continue
    const value = bounded(attributeValue(attributes, 'content'), maxLength)
    if (value) values.push(value)
  }

  return values.slice(0, 100)
}

function firstText(html: string, pattern: RegExp, maxLength: number) {
  const match = pattern.exec(html)
  return bounded(match?.[1], maxLength)
}

function sourceNameFromUrl(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, '')
  } catch {
    return undefined
  }
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

/** Extract conservative microdata and page-title facts from bounded HTML. */
export function extractGenericRecipe(
  html: string,
  sourceUrl: string,
): RecipeImportCandidate {
  const title =
    firstText(
      html,
      /<meta\b[^>]*\bproperty\s*=\s*["']og:title["'][^>]*\bcontent\s*=\s*["']([^"']*)["'][^>]*>/i,
      textLimits.title,
    ) ??
    firstText(
      html,
      /<meta\b[^>]*\bname\s*=\s*["']title["'][^>]*\bcontent\s*=\s*["']([^"']*)["'][^>]*>/i,
      textLimits.title,
    ) ??
    firstText(html, /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i, textLimits.title) ??
    firstText(html, /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i, textLimits.title)
  const ingredients = itempropValues(
    html,
    'recipeIngredient',
    textLimits.ingredient,
  ).map(ingredientFromLine)
  const instructions = itempropValues(
    html,
    'recipeInstructions',
    textLimits.instruction,
  )

  const sourceName = sourceNameFromUrl(sourceUrl)
  const candidate: RecipeImportCandidate = {
    ...(title ? { title } : {}),
    ingredients,
    instructions,
    ...(sourceName ? { sourceName } : {}),
    sourceUrl,
    warnings: [
      'Generic extraction was used. Review every imported field before saving.',
    ],
  }

  if (!candidate.title)
    candidate.warnings.push('The source did not provide a usable title.')
  candidate.warnings.push(
    'The source did not provide a single whole-number yield.',
  )
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
