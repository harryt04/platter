/**
 * Categories are intentionally conservative defaults for a typical grocery
 * store. They help organize a run without claiming that Platter knows the
 * shopper's exact store layout; anything uncertain stays in Other.
 */
export const groceryCategoryDefinitions = {
  produce: {
    label: 'Produce',
    description: 'Fresh fruits, vegetables, and herbs.',
  },
  'meat-seafood': {
    label: 'Meat and seafood',
    description: 'Meat, poultry, fish, and seafood.',
  },
  'dairy-eggs': {
    label: 'Dairy and eggs',
    description: 'Milk, cheese, cultured dairy, butter, and eggs.',
  },
  bakery: {
    label: 'Bakery',
    description: 'Bread, rolls, tortillas, and other baked goods.',
  },
  pantry: {
    label: 'Pantry',
    description: 'Shelf-stable staples, oils, sauces, and spices.',
  },
  'canned-goods': {
    label: 'Canned goods',
    description: 'Canned, tinned, and jarred pantry items.',
  },
  frozen: {
    label: 'Frozen',
    description: 'Frozen ingredients and prepared foods.',
  },
  beverages: {
    label: 'Beverages',
    description: 'Drinks, coffee, tea, and drink mixers.',
  },
  baking: {
    label: 'Baking',
    description: 'Baking ingredients and decorating supplies.',
  },
  household: {
    label: 'Household',
    description: 'Paper goods, cleaning supplies, and household items.',
  },
  other: {
    label: 'Other',
    description: 'Items that are uncategorized or need a shopper decision.',
  },
} as const

export type GroceryCategory = keyof typeof groceryCategoryDefinitions

const categoryKeywords: ReadonlyArray<readonly [GroceryCategory, ...string[]]> =
  [
    [
      'household',
      'paper towel',
      'paper towels',
      'toilet paper',
      'trash bag',
      'trash bags',
      'garbage bag',
      'garbage bags',
      'dish soap',
      'dishwasher detergent',
      'laundry detergent',
      'aluminum foil',
      'plastic wrap',
      'parchment paper',
    ],
    [
      'beverages',
      'water',
      'juice',
      'coffee',
      'tea',
      'soda',
      'soft drink',
      'lemonade',
      'wine',
      'beer',
      'cider',
    ],
    ['frozen', 'frozen', 'ice cream', 'sorbet'],
    [
      'meat-seafood',
      'beef',
      'steak',
      'ground beef',
      'chicken',
      'turkey',
      'pork',
      'bacon',
      'ham',
      'sausage',
      'lamb',
      'salmon',
      'tuna',
      'shrimp',
      'prawn',
      'fish',
      'seafood',
      'anchovy',
    ],
    [
      'dairy-eggs',
      'milk',
      'cream',
      'butter',
      'cheese',
      'yogurt',
      'yoghurt',
      'egg',
      'eggs',
      'sour cream',
      'cottage cheese',
    ],
    [
      'bakery',
      'bread',
      'bun',
      'buns',
      'roll',
      'rolls',
      'tortilla',
      'tortillas',
      'pita',
      'naan',
      'bagel',
      'bagels',
      'croissant',
    ],
    [
      'baking',
      'flour',
      'baking soda',
      'baking powder',
      'yeast',
      'cocoa',
      'chocolate chips',
      'powdered sugar',
      'confectioners sugar',
      'vanilla extract',
    ],
    [
      'produce',
      'apple',
      'apples',
      'avocado',
      'avocados',
      'banana',
      'bananas',
      'berries',
      'broccoli',
      'cabbage',
      'carrot',
      'carrots',
      'celery',
      'cucumber',
      'cucumbers',
      'eggplant',
      'garlic',
      'ginger',
      'herb',
      'herbs',
      'kale',
      'lettuce',
      'mushroom',
      'mushrooms',
      'onion',
      'onions',
      'potato',
      'potatoes',
      'spinach',
      'tomato',
      'tomatoes',
      'zucchini',
    ],
    [
      'pantry',
      'rice',
      'pasta',
      'noodle',
      'noodles',
      'oat',
      'oats',
      'oil',
      'olive oil',
      'vinegar',
      'soy sauce',
      'hot sauce',
      'mustard',
      'ketchup',
      'mayonnaise',
      'broth',
      'stock',
      'salt',
      'pepper',
      'spice',
      'spices',
      'sugar',
      'nuts',
      'almonds',
      'peanuts',
    ],
  ]

function normalize(value: string | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function containsKeyword(value: string, keyword: string) {
  return ` ${value} `.includes(` ${keyword} `)
}

/**
 * Classify one derived item only when its parser facts are high confidence.
 * The original lines are considered so units such as "1 can tomatoes" can be
 * placed in Canned goods without changing the normalized ingredient identity.
 */
export function defaultGroceryCategory({
  ingredientName,
  normalizedIdentity,
  originalTexts = [],
  parserConfidence = 'high',
}: {
  ingredientName: string
  normalizedIdentity?: string
  originalTexts?: readonly string[]
  parserConfidence?: 'high' | 'medium' | 'low'
}): GroceryCategory {
  if (parserConfidence !== 'high') return 'other'

  const ingredient = normalize(normalizedIdentity ?? ingredientName) ?? ''
  const sourceText = originalTexts
    .map((text) => normalize(text) ?? '')
    .join(' ')
  const combined = `${ingredient} ${sourceText}`.trim()

  if (/(^| )(can|cans|tin|tins|canned|tinned|jar|jars)( |$)/.test(sourceText)) {
    return 'canned-goods'
  }

  for (const [category, ...keywords] of categoryKeywords) {
    if (keywords.some((keyword) => containsKeyword(combined, keyword))) {
      return category
    }
  }

  return 'other'
}

export function groceryCategoryLabel(category: GroceryCategory) {
  return groceryCategoryDefinitions[category].label
}
