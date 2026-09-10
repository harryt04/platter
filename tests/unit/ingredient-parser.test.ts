import fc from 'fast-check'
import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  convertIngredientQuantity,
  parseIngredientLine,
} from '@/lib/recipes/ingredient-parser'

describe('ingredient line parser', () => {
  it.each([
    {
      line: '1 1/2 cups flour',
      quantity: { min: '1.5' },
      unit: { name: 'cup', dimension: 'volume' },
      ingredientName: 'flour',
    },
    {
      line: '½ cup finely chopped parsley',
      quantity: { min: '0.5' },
      unit: { name: 'cup', dimension: 'volume' },
      ingredientName: 'finely chopped parsley',
    },
    {
      line: '2–3 cloves garlic, minced',
      quantity: { min: '2', max: '3' },
      unit: { name: 'clove', dimension: 'count' },
      ingredientName: 'garlic',
      preparationNote: 'minced',
    },
  ])('parses $line', ({ line, ...expected }) => {
    expect(parseIngredientLine(line)).toMatchObject(expected)
  })

  it('recognizes a word range and keeps count ingredients distinct', () => {
    expect(parseIngredientLine('2 to 4 yellow onions')).toMatchObject({
      quantity: { min: '2', max: '4' },
      unit: { name: 'each', dimension: 'count' },
      ingredientName: 'yellow onions',
    })
  })

  it('degrades missing quantities to a readable ingredient', () => {
    expect(parseIngredientLine('salt, to taste')).toMatchObject({
      quantity: null,
      unit: { name: 'unknown', dimension: 'unknown' },
      ingredientName: 'salt',
      preparationNote: 'to taste',
    })
  })

  it.each([
    {
      line: '1 (15-ounce) can diced tomatoes',
      packageSize: {
        quantity: { min: '15' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'diced tomatoes',
      unit: { name: 'can', dimension: 'count' },
    },
    {
      line: '2 x 14 oz cans beans',
      packageSize: {
        quantity: { min: '14' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'beans',
      unit: { name: 'can', dimension: 'count' },
    },
    {
      line: '1 can (15 oz) tomatoes',
      packageSize: {
        quantity: { min: '15' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'tomatoes',
      unit: { name: 'can', dimension: 'count' },
    },
    {
      line: '2 14-ounce cans chickpeas',
      packageSize: {
        quantity: { min: '14' },
        unit: { name: 'oz', dimension: 'mass' },
      },
      ingredientName: 'chickpeas',
      unit: { name: 'can', dimension: 'count' },
    },
  ])('preserves package size for $line', ({ line, ...expected }) => {
    expect(parseIngredientLine(line)).toMatchObject(expected)
  })

  it('marks optional ingredients without losing their name or preparation', () => {
    expect(
      parseIngredientLine('1 tbsp olive oil (optional), for frying'),
    ).toMatchObject({
      quantity: { min: '1' },
      unit: { name: 'tbsp', dimension: 'volume' },
      ingredientName: 'olive oil',
      preparationNote: 'for frying',
      optional: true,
    })
  })

  it('preserves sanitized source text for correction and display', () => {
    expect(parseIngredientLine('  2 eggs\u0000  ')).toMatchObject({
      originalText: '2 eggs',
      quantity: { min: '2' },
      ingredientName: 'eggs',
      normalizedIdentity: 'eggs',
      parserConfidence: 'medium',
    })
  })

  it('records confidence and a stable identity without erasing distinctions', () => {
    expect(parseIngredientLine('1 1/2 cups Crème fraîche')).toMatchObject({
      normalizedIdentity: 'creme fraiche',
      parserConfidence: 'high',
    })
    expect(parseIngredientLine('3 yellow onions')).toMatchObject({
      normalizedIdentity: 'yellow onions',
      parserConfidence: 'medium',
    })
    expect(parseIngredientLine('1/0 cup sugar')).toMatchObject({
      parserConfidence: 'low',
    })
    expect(parseIngredientLine('1/0 cup sugar')).not.toHaveProperty(
      'normalizedIdentity',
    )
  })

  it.each([
    ['2 scallions', 'green onions'],
    ['1 spring onion', 'green onions'],
    ['1 aubergine', 'eggplant'],
    ['1 garbanzo bean', 'chickpeas'],
    ['1 can garbanzo beans', 'chickpeas'],
    ['1 cup icing sugar', 'powdered sugar'],
  ])('resolves %s to the canonical identity %s', (line, identity) => {
    expect(parseIngredientLine(line)).toMatchObject({
      normalizedIdentity: identity,
    })
  })

  it('does not alias distinct onion varieties into one shopping identity', () => {
    expect(parseIngredientLine('2 yellow onions').normalizedIdentity).toBe(
      'yellow onions',
    )
    expect(parseIngredientLine('2 red onions').normalizedIdentity).toBe(
      'red onions',
    )
  })

  it('retains calculation precision and degrades malformed quantities safely', () => {
    expect(parseIngredientLine('1/3 cup sugar').quantity).toEqual({
      min: '0.33333333333333333333',
    })
    expect(parseIngredientLine('1/0 cup sugar')).toMatchObject({
      quantity: null,
      ingredientName: '1/0 cup sugar',
    })
  })

  it.each(['1 cup', '1 cup (optional)', 'optional'])(
    'keeps an incomplete line readable without inventing an amount: %s',
    (line) => {
      expect(parseIngredientLine(line)).toMatchObject({
        originalText: line,
        quantity: null,
        unit: { name: 'unknown', dimension: 'unknown' },
        ingredientName: line,
        parserConfidence: 'low',
      })
    },
  )

  it('parses decimal quantities using the requested locale', () => {
    expect(
      parseIngredientLine('1,5 kg farine', { locale: 'fr-FR' }),
    ).toMatchObject({
      quantity: { min: '1.5' },
      unit: { name: 'kg', dimension: 'mass' },
      ingredientName: 'farine',
    })
  })

  it.each([
    {
      locale: 'en-US',
      from: { name: 'lb', dimension: 'mass' as const },
      to: { name: 'g', dimension: 'mass' as const },
      expected: { min: '453.59237', max: '907.18474' },
    },
    {
      locale: 'en-US',
      from: { name: 'cup', dimension: 'volume' as const },
      to: { name: 'ml', dimension: 'volume' as const },
      expected: { min: '236.5882365' },
    },
    {
      locale: 'en-GB',
      from: { name: 'pint', dimension: 'volume' as const },
      to: { name: 'ml', dimension: 'volume' as const },
      expected: { min: '568.26125' },
    },
  ])(
    'converts $from.name deterministically for $locale',
    ({ locale, from, to, expected }) => {
      expect(
        convertIngredientQuantity(
          { min: '1', max: from.name === 'lb' ? '2' : undefined },
          from,
          to,
          locale,
        ),
      ).toEqual(expected)
    },
  )

  it('rejects incompatible dimensions and non-equivalent count units', () => {
    expect(
      convertIngredientQuantity(
        { min: '1' },
        { name: 'kg', dimension: 'mass' },
        { name: 'ml', dimension: 'volume' },
      ),
    ).toBeNull()
    expect(
      convertIngredientQuantity(
        { min: '1' },
        { name: 'can', dimension: 'count' },
        { name: 'each', dimension: 'count' },
      ),
    ).toBeNull()
  })

  it.each([
    ['gram', 'g', 'mass'],
    ['kilograms', 'kg', 'mass'],
    ['ounces', 'oz', 'mass'],
    ['pounds', 'lb', 'mass'],
    ['milliliters', 'ml', 'volume'],
    ['litres', 'l', 'volume'],
    ['teaspoons', 'tsp', 'volume'],
    ['tablespoons', 'tbsp', 'volume'],
    ['cups', 'cup', 'volume'],
    ['fluid ounces', 'fl oz', 'volume'],
    ['pieces', 'each', 'count'],
    ['pinches', 'pinch', 'unknown'],
  ] as const)(
    'normalizes the supported unit alias %s',
    (alias, name, dimension) => {
      expect(parseIngredientLine(`2 ${alias} sugar`)).toMatchObject({
        quantity: { min: '2' },
        unit: { name, dimension },
        ingredientName: 'sugar',
      })
    },
  )

  it('keeps fraction precision across a table of supported denominators', () => {
    const cases = [
      ['1/3 cup sugar', '0.33333333333333333333'],
      ['1/7 cup sugar', '0.14285714285714285714'],
      ['2 5/8 cups flour', '2.625'],
      ['1½ cups milk', '1.5'],
    ] as const

    for (const [line, expected] of cases) {
      expect(parseIngredientLine(line).quantity).toEqual({ min: expected })
    }
  })

  it('parses generated positive fraction quantities without display rounding', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 2, max: 1000 }),
        (numerator, denominator) => {
          const parsed = parseIngredientLine(
            `${numerator}/${denominator} cups flour`,
          )
          const expected = new Decimal(numerator)
            .dividedBy(denominator)
            .toString()

          expect(parsed.quantity).toEqual({ min: expected })
          expect(parsed.ingredientName).toBe('flour')
        },
      ),
    )
  })

  it('preserves mass and volume conversion round trips for generated amounts', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (amount) => {
        const quantity = { min: String(amount), max: String(amount + 1) }
        const massInKilograms = convertIngredientQuantity(
          quantity,
          { name: 'g', dimension: 'mass' },
          { name: 'kg', dimension: 'mass' },
        )
        const volumeInUsCups = convertIngredientQuantity(
          quantity,
          { name: 'ml', dimension: 'volume' },
          { name: 'cup', dimension: 'volume' },
          'en-US',
        )

        expect(
          massInKilograms &&
            convertIngredientQuantity(
              massInKilograms,
              { name: 'kg', dimension: 'mass' },
              { name: 'g', dimension: 'mass' },
            ),
        ).toEqual(quantity)
        const volumeRoundTrip = volumeInUsCups
          ? convertIngredientQuantity(
              volumeInUsCups,
              { name: 'cup', dimension: 'volume' },
              { name: 'ml', dimension: 'volume' },
              'en-US',
            )
          : null
        expect(volumeRoundTrip).not.toBeNull()
        expect(
          new Decimal(volumeRoundTrip!.min)
            .minus(amount)
            .abs()
            .lessThan('1e-30'),
        ).toBe(true)
        expect(
          new Decimal(volumeRoundTrip!.max!)
            .minus(amount + 1)
            .abs()
            .lessThan('1e-30'),
        ).toBe(true)
      }),
    )
  })

  it('never throws while degrading arbitrary source lines', () => {
    fc.assert(
      fc.property(fc.string(), (line) => {
        const parsed = parseIngredientLine(line)

        expect(parsed.originalText).toBe(
          line
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        expect(parsed.parserConfidence).toMatch(/^(high|medium|low)$/)
        if (parsed.quantity === null) {
          expect(parsed.unit).toEqual({ name: 'unknown', dimension: 'unknown' })
        }
      }),
    )
  })
})
