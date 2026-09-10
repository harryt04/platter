import { describe, expect, it } from 'vitest'
import { extractSchemaOrgRecipe } from '@/lib/recipe-import-schema-org'

const sourceUrl = 'https://recipes.example.test/roasted-vegetables'

describe('Schema.org recipe import adapter', () => {
  it('maps JSON-LD Recipe facts into the structured editor shape', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [{
                "@type": "Recipe",
                "name": "Roasted Vegetables",
                "recipeYield": "Serves 4",
                "recipeIngredient": ["1 cup carrots, sliced", "½ tsp salt"],
                "recipeInstructions": [
                  {"@type": "HowToStep", "text": "Heat the oven."},
                  {"@type": "HowToSection", "name": "Roast", "itemListElement": [
                    {"@type": "HowToStep", "text": "Roast until tender."}
                  ]}
                ],
                "prepTime": "PT15M",
                "cookTime": "PT1H30M",
                "totalTime": "PT1H45M",
                "recipeCuisine": "Mediterranean",
                "recipeCategory": "Side dish",
                "keywords": "vegetables, weeknight",
                "suitableForDiet": ["https://schema.org/VegetarianDiet"],
                "author": {"@type": "Person", "name": "Avery Cook"},
                "publisher": {"@type": "Organization", "name": "Example Recipes"},
                "citation": "Shared with permission."
              }]
            }
          </script>
        </head>
      </html>
    `

    expect(extractSchemaOrgRecipe(html, sourceUrl)).toEqual({
      title: 'Roasted Vegetables',
      typicalPeopleFed: 4,
      ingredients: [
        {
          originalText: '1 cup carrots, sliced',
          quantity: '1',
          unit: 'cup',
          ingredientName: 'carrots',
          normalizedIdentity: 'carrots',
          parserConfidence: 'high',
          preparationNote: 'sliced',
          optional: false,
        },
        {
          originalText: '½ tsp salt',
          quantity: '0.5',
          unit: 'tsp',
          ingredientName: 'salt',
          normalizedIdentity: 'salt',
          parserConfidence: 'high',
          optional: false,
        },
      ],
      instructions: ['Heat the oven.', 'Roast until tender.'],
      prepTimeMinutes: 15,
      cookingTimeMinutes: 90,
      totalTimeMinutes: 105,
      cuisine: 'Mediterranean',
      mealType: 'Side dish',
      tags: ['vegetables', 'weeknight'],
      dietaryLabels: ['Vegetarian'],
      sourceName: 'Example Recipes',
      sourceUrl,
      sourceAuthor: 'Avery Cook',
      attribution: 'Shared with permission.',
      warnings: [],
    })
  })

  it('returns a partial candidate with warnings instead of fabricating missing facts', () => {
    const html = `<script type="application/ld+json">{
      "@type": "Recipe",
      "name": "No Yield Soup",
      "recipeCuisine": "Mediterranean",
      "recipeIngredient": ["salt to taste"]
      ,"keywords": "weeknight, soup",
      "author": {"name": "Avery Cook"},
      "publisher": {"name": "Example Recipes"}
    }</script>`

    expect(extractSchemaOrgRecipe(html, sourceUrl)).toMatchObject({
      title: 'No Yield Soup',
      cuisine: 'Mediterranean',
      tags: ['weeknight', 'soup'],
      sourceAuthor: 'Avery Cook',
      sourceName: 'Example Recipes',
      ingredients: [
        expect.objectContaining({
          originalText: 'salt to taste',
          ingredientName: 'salt to taste',
          parserConfidence: 'low',
        }),
      ],
      instructions: [],
      warnings: [
        'The source did not provide a single whole-number yield.',
        'The source did not provide structured instructions.',
      ],
    })
  })

  it('ignores malformed JSON-LD and non-Recipe structured data', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Product","name":"Not a recipe"}</script>
      <script type="application/ld+json">{"@type":"Recipe",</script>
      <script type="text/javascript">window.alert('not executed')</script>
    `

    expect(extractSchemaOrgRecipe(html, sourceUrl)).toBeNull()
  })

  it('strips hostile markup and ignores unsupported editorial prose', () => {
    const jsonLd = JSON.stringify({
      '@type': 'Recipe',
      name: '<img src=x onerror="alert(1)">Safe <strong>Soup</strong>',
      description: '<p>This editorial story should not be imported.</p>',
      recipeYield: '4',
      recipeIngredient: [
        '<script>alert(1)</script>1 cup carrots <em>, sliced</em>',
      ],
      recipeInstructions: [
        {
          '@type': 'HowToStep',
          text: '<a href="javascript:alert(1)">Stir</a> until ready.',
        },
      ],
      author: '<span>Chef Avery</span>',
      publisher: '<div>Safe Kitchen</div>',
    }).replaceAll('</script', '<\\/script')
    const html = `<script type="application/ld+json">${jsonLd}</script>`

    expect(extractSchemaOrgRecipe(html, sourceUrl)).toMatchObject({
      title: 'Safe Soup',
      ingredients: [
        expect.objectContaining({
          originalText: '1 cup carrots , sliced',
          ingredientName: 'carrots',
          preparationNote: 'sliced',
        }),
      ],
      instructions: ['Stir until ready.'],
      sourceName: 'Safe Kitchen',
      sourceAuthor: 'Chef Avery',
    })
    const candidate = extractSchemaOrgRecipe(html, sourceUrl)
    expect(JSON.stringify(candidate)).not.toMatch(
      /<|script|onerror|javascript:/i,
    )
    expect(JSON.stringify(candidate)).not.toContain(
      'This editorial story should not be imported',
    )
  })
})
