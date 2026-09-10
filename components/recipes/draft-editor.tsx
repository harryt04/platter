'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowUp, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type {
  RecipeImageProvenance,
  RecipeIngredient,
  RecipeInstruction,
  RecipeNutrition,
} from '@/lib/recipes/drafts'

type IngredientForm = RecipeIngredient

const blankIngredient = (): IngredientForm => ({
  originalText: '',
  quantity: '',
  unit: '',
  ingredientName: '',
  preparationNote: '',
  optional: false,
})

function moveItem<T>(items: T[], index: number, offset: -1 | 1) {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= items.length) return items

  const next = [...items]
  const current = next[index]
  next[index] = next[targetIndex]
  next[targetIndex] = current
  return next
}

function splitLabels(value: string) {
  return value
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
}

function definedNutritionValues(nutrition: RecipeNutrition) {
  return Object.fromEntries(
    Object.entries(nutrition).filter(([, value]) => value !== undefined),
  ) as RecipeNutrition
}

export function DraftEditor({
  recipeId,
  initialTitle = '',
  initialDescription = '',
  initialTypicalPeopleFed,
  initialPrepTimeMinutes,
  initialCookingTimeMinutes,
  initialTotalTimeMinutes,
  initialCuisine = '',
  initialMealType = '',
  initialHouseholdNotes = '',
  initialSourceName = '',
  initialSourceUrl = '',
  initialSourceAuthor = '',
  initialAttribution = '',
  initialImage,
  initialNutrition,
  initialTags = [],
  initialDietaryLabels = [],
  initialIngredients = [],
  initialInstructions = [],
}: {
  recipeId?: string
  initialTitle?: string
  initialDescription?: string
  initialTypicalPeopleFed?: number
  initialPrepTimeMinutes?: number
  initialCookingTimeMinutes?: number
  initialTotalTimeMinutes?: number
  initialCuisine?: string
  initialMealType?: string
  initialHouseholdNotes?: string
  initialSourceName?: string
  initialSourceUrl?: string
  initialSourceAuthor?: string
  initialAttribution?: string
  initialImage?: RecipeImageProvenance
  initialNutrition?: RecipeNutrition
  initialTags?: string[]
  initialDietaryLabels?: string[]
  initialIngredients?: RecipeIngredient[]
  initialInstructions?: RecipeInstruction[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [typicalPeopleFed, setTypicalPeopleFed] = useState(
    initialTypicalPeopleFed?.toString() ?? '',
  )
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(
    initialPrepTimeMinutes?.toString() ?? '',
  )
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState(
    initialCookingTimeMinutes?.toString() ?? '',
  )
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(
    initialTotalTimeMinutes?.toString() ?? '',
  )
  const [cuisine, setCuisine] = useState(initialCuisine)
  const [mealType, setMealType] = useState(initialMealType)
  const [householdNotes, setHouseholdNotes] = useState(initialHouseholdNotes)
  const [sourceName, setSourceName] = useState(initialSourceName)
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl)
  const [sourceAuthor, setSourceAuthor] = useState(initialSourceAuthor)
  const [attribution, setAttribution] = useState(initialAttribution)
  const [imageUrl, setImageUrl] = useState(initialImage?.url ?? '')
  const [imageAltText, setImageAltText] = useState(initialImage?.altText ?? '')
  const [imageSourceName, setImageSourceName] = useState(
    initialImage?.sourceName ?? '',
  )
  const [imageSourceUrl, setImageSourceUrl] = useState(
    initialImage?.sourceUrl ?? '',
  )
  const [imageCreator, setImageCreator] = useState(initialImage?.creator ?? '')
  const [imageLicense, setImageLicense] = useState(initialImage?.license ?? '')
  const [imageRightsStatus, setImageRightsStatus] = useState<
    RecipeImageProvenance['rightsStatus']
  >(initialImage?.rightsStatus ?? 'unknown')
  const [nutrition, setNutrition] = useState<RecipeNutrition>(
    initialNutrition ?? {},
  )
  const [tags, setTags] = useState(initialTags.join(', '))
  const [dietaryLabels, setDietaryLabels] = useState(
    initialDietaryLabels.join(', '),
  )
  const [ingredients, setIngredients] =
    useState<IngredientForm[]>(initialIngredients)
  const [instructions, setInstructions] =
    useState<RecipeInstruction[]>(initialInstructions)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function updateIngredient(index: number, changes: Partial<IngredientForm>) {
    setIngredients((current) =>
      current.map((ingredient, itemIndex) =>
        itemIndex === index ? { ...ingredient, ...changes } : ingredient,
      ),
    )
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        recipeId ? `/api/v1/recipes/${recipeId}` : '/api/v1/recipes',
        {
          method: recipeId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            recipeId
              ? {
                  title,
                  description,
                  typicalPeopleFed:
                    typicalPeopleFed === '' ? null : Number(typicalPeopleFed),
                  prepTimeMinutes:
                    prepTimeMinutes === '' ? null : Number(prepTimeMinutes),
                  cookingTimeMinutes:
                    cookingTimeMinutes === ''
                      ? null
                      : Number(cookingTimeMinutes),
                  totalTimeMinutes:
                    totalTimeMinutes === '' ? null : Number(totalTimeMinutes),
                  cuisine,
                  mealType,
                  householdNotes,
                  sourceName,
                  sourceUrl,
                  sourceAuthor,
                  attribution,
                  image:
                    imageUrl.trim() === ''
                      ? null
                      : {
                          url: imageUrl,
                          altText: imageAltText,
                          sourceName: imageSourceName,
                          sourceUrl: imageSourceUrl,
                          creator: imageCreator,
                          license: imageLicense,
                          rightsStatus: imageRightsStatus,
                        },
                  nutrition:
                    Object.keys(definedNutritionValues(nutrition)).length > 0
                      ? definedNutritionValues(nutrition)
                      : null,
                  tags: splitLabels(tags),
                  dietaryLabels: splitLabels(dietaryLabels),
                  ingredients,
                  instructions,
                }
              : { title },
          ),
        },
      )
      if (!response.ok) {
        const problem = (await response.json()) as { detail?: string }
        throw new Error(problem.detail ?? 'We couldn’t save this draft.')
      }
      const result = (await response.json()) as { recipe: { id: string } }
      router.push(`/recipes/${result.recipe.id}/edit`)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t save this draft.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {recipeId ? 'Recipe draft' : 'Start with a title'}
        </CardTitle>
        <CardDescription>
          A title is enough to save your private draft. You can add ingredients
          and directions later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="recipe-title">Recipe title</Label>
            <Input
              id="recipe-title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Sunday tomato soup"
              maxLength={200}
              required
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              Private until you choose to share or publish it. A title alone
              stays a draft.
            </p>
          </div>
          {recipeId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recipe-description">
                  Description{' '}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="recipe-description"
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="A cozy weeknight soup with a bright finish."
                  maxLength={2000}
                />
                <p className="text-muted-foreground text-xs">
                  Keep it useful and concise. Platter removes control characters
                  before saving.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="typical-people-fed">Typical people fed</Label>
                <Input
                  id="typical-people-fed"
                  name="typicalPeopleFed"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={typicalPeopleFed}
                  onChange={(event) => setTypicalPeopleFed(event.target.value)}
                  placeholder="4"
                />
                <p className="text-muted-foreground text-xs">
                  Use a positive whole number. This recipe becomes usable when
                  it also has an ingredient.
                </p>
              </div>
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium">Recipe details</legend>
                <p className="text-muted-foreground text-xs">
                  Add timing and labels to make this recipe easier to recognize
                  later. All of these details are optional.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="prep-time-minutes">
                      Prep time (minutes)
                    </Label>
                    <Input
                      id="prep-time-minutes"
                      name="prepTimeMinutes"
                      type="number"
                      min="0"
                      max="10080"
                      step="1"
                      inputMode="numeric"
                      value={prepTimeMinutes}
                      onChange={(event) =>
                        setPrepTimeMinutes(event.target.value)
                      }
                      placeholder="15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cooking-time-minutes">
                      Cooking time (minutes)
                    </Label>
                    <Input
                      id="cooking-time-minutes"
                      name="cookingTimeMinutes"
                      type="number"
                      min="0"
                      max="10080"
                      step="1"
                      inputMode="numeric"
                      value={cookingTimeMinutes}
                      onChange={(event) =>
                        setCookingTimeMinutes(event.target.value)
                      }
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total-time-minutes">
                      Total time (minutes)
                    </Label>
                    <Input
                      id="total-time-minutes"
                      name="totalTimeMinutes"
                      type="number"
                      min="0"
                      max="10080"
                      step="1"
                      inputMode="numeric"
                      value={totalTimeMinutes}
                      onChange={(event) =>
                        setTotalTimeMinutes(event.target.value)
                      }
                      placeholder="45"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recipe-cuisine">Cuisine</Label>
                    <Input
                      id="recipe-cuisine"
                      name="cuisine"
                      value={cuisine}
                      onChange={(event) => setCuisine(event.target.value)}
                      placeholder="Mediterranean"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipe-meal-type">Meal type</Label>
                    <Input
                      id="recipe-meal-type"
                      name="mealType"
                      value={mealType}
                      onChange={(event) => setMealType(event.target.value)}
                      placeholder="Dinner"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recipe-tags">Tags</Label>
                    <Input
                      id="recipe-tags"
                      name="tags"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="weeknight, make ahead"
                      maxLength={1050}
                    />
                    <p className="text-muted-foreground text-xs">
                      Separate labels with commas, up to 20.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipe-dietary-labels">
                      Dietary labels
                    </Label>
                    <Input
                      id="recipe-dietary-labels"
                      name="dietaryLabels"
                      value={dietaryLabels}
                      onChange={(event) => setDietaryLabels(event.target.value)}
                      placeholder="vegetarian, gluten-free"
                      maxLength={1050}
                    />
                    <p className="text-muted-foreground text-xs">
                      Separate labels with commas, up to 20.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipe-household-notes">
                    Household notes{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="recipe-household-notes"
                    name="householdNotes"
                    value={householdNotes}
                    onChange={(event) => setHouseholdNotes(event.target.value)}
                    placeholder="Use less salt for the kids."
                    maxLength={2000}
                  />
                  <p className="text-muted-foreground text-xs">
                    Keep notes useful for your household. Platter removes
                    control characters before saving.
                  </p>
                </div>
                <fieldset className="border-border space-y-4 rounded-[var(--radius-card)] border p-4">
                  <legend className="px-1 text-sm font-medium">
                    Nutrition per person{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </legend>
                  <p className="text-muted-foreground text-xs">
                    Add values from a trusted source when you have them. These
                    figures are informational and are not health guidance.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        ['calories', 'Calories', 'kcal'],
                        ['proteinGrams', 'Protein', 'g'],
                        ['carbohydratesGrams', 'Carbohydrates', 'g'],
                        ['fatGrams', 'Fat', 'g'],
                        ['fiberGrams', 'Fiber', 'g'],
                        ['sodiumMilligrams', 'Sodium', 'mg'],
                      ] as const
                    ).map(([field, label, unit]) => (
                      <div className="space-y-2" key={field}>
                        <Label htmlFor={`recipe-nutrition-${field}`}>
                          {label} ({unit})
                        </Label>
                        <Input
                          id={`recipe-nutrition-${field}`}
                          name={field}
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={nutrition[field]?.toString() ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            setNutrition((current) => {
                              const next = { ...current }
                              if (value === '') {
                                delete next[field]
                              } else {
                                next[field] = Number(value)
                              }
                              return next
                            })
                          }}
                          placeholder="—"
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="border-border space-y-4 rounded-[var(--radius-card)] border p-4">
                  <legend className="px-1 text-sm font-medium">
                    Source and attribution
                  </legend>
                  <p className="text-muted-foreground text-xs">
                    If this recipe came from elsewhere, keep its source facts
                    with the private draft. Source links must use HTTP or HTTPS.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="recipe-source-name">
                        Source name{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="recipe-source-name"
                        name="sourceName"
                        value={sourceName}
                        onChange={(event) => setSourceName(event.target.value)}
                        placeholder="Neighborhood cookbook"
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipe-source-author">
                        Source author{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="recipe-source-author"
                        name="sourceAuthor"
                        value={sourceAuthor}
                        onChange={(event) =>
                          setSourceAuthor(event.target.value)
                        }
                        placeholder="Alex Rivera"
                        maxLength={200}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipe-source-url">
                      Source URL{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="recipe-source-url"
                      name="sourceUrl"
                      type="url"
                      inputMode="url"
                      value={sourceUrl}
                      onChange={(event) => setSourceUrl(event.target.value)}
                      placeholder="https://example.com/recipe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipe-attribution">
                      Attribution{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="recipe-attribution"
                      name="attribution"
                      value={attribution}
                      onChange={(event) => setAttribution(event.target.value)}
                      placeholder="Adapted with permission from the original author."
                      maxLength={1000}
                    />
                    <p className="text-muted-foreground text-xs">
                      Keep attribution factual. It will remain separate from
                      recipe instructions and editorial prose.
                    </p>
                  </div>
                </fieldset>
                <fieldset className="border-border space-y-4 rounded-[var(--radius-card)] border p-4">
                  <legend className="px-1 text-sm font-medium">
                    Image provenance{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </legend>
                  <p className="text-muted-foreground text-xs">
                    Add an HTTP or HTTPS image only when you can use it. Record
                    what you know; unknown rights stay explicit and will not
                    make the image public automatically.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="recipe-image-url">Image URL</Label>
                    <Input
                      id="recipe-image-url"
                      name="imageUrl"
                      type="url"
                      inputMode="url"
                      value={imageUrl}
                      onChange={(event) => setImageUrl(event.target.value)}
                      placeholder="https://images.example.com/soup.jpg"
                      maxLength={2048}
                    />
                    {imageUrl && (
                      <p className="text-muted-foreground text-xs">
                        This address is stored with the private draft and will
                        not make the image public automatically.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipe-image-alt-text">
                      Image description{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="recipe-image-alt-text"
                      name="imageAltText"
                      value={imageAltText}
                      onChange={(event) => setImageAltText(event.target.value)}
                      placeholder="Bowl of tomato soup with herbs"
                      maxLength={300}
                    />
                    <p className="text-muted-foreground text-xs">
                      Describe what the image shows for people using a screen
                      reader.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="recipe-image-source-name">
                        Image source name{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="recipe-image-source-name"
                        name="imageSourceName"
                        value={imageSourceName}
                        onChange={(event) =>
                          setImageSourceName(event.target.value)
                        }
                        placeholder="My kitchen"
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipe-image-creator">
                        Image creator{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="recipe-image-creator"
                        name="imageCreator"
                        value={imageCreator}
                        onChange={(event) =>
                          setImageCreator(event.target.value)
                        }
                        placeholder="Your name"
                        maxLength={200}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="recipe-image-source-url">
                        Image source URL{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="recipe-image-source-url"
                        name="imageSourceUrl"
                        type="url"
                        inputMode="url"
                        value={imageSourceUrl}
                        onChange={(event) =>
                          setImageSourceUrl(event.target.value)
                        }
                        placeholder="https://example.com/image"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipe-image-license">
                        License or permission{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="recipe-image-license"
                        name="imageLicense"
                        value={imageLicense}
                        onChange={(event) =>
                          setImageLicense(event.target.value)
                        }
                        placeholder="CC BY 4.0 or personal permission"
                        maxLength={300}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipe-image-rights-status">
                      Image rights status
                    </Label>
                    <select
                      id="recipe-image-rights-status"
                      name="imageRightsStatus"
                      value={imageRightsStatus}
                      onChange={(event) =>
                        setImageRightsStatus(
                          event.target
                            .value as RecipeImageProvenance['rightsStatus'],
                        )
                      }
                      className="bg-background focus:ring-ring min-h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm outline-none focus:ring-2"
                    >
                      <option value="user-owned">I created or own it</option>
                      <option value="licensed">Licensed for reuse</option>
                      <option value="permission-granted">
                        Permission granted
                      </option>
                      <option value="unknown">Rights are unknown</option>
                    </select>
                    <p className="text-muted-foreground text-xs">
                      This status records what is known; it is not a legal
                      determination.
                    </p>
                  </div>
                </fieldset>
              </fieldset>
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium">Ingredients</legend>
                <p className="text-muted-foreground text-xs">
                  Keep the original line alongside the structured details so the
                  recipe stays easy to check later.
                </p>
                {ingredients.map((ingredient, index) => (
                  <div
                    className="border-border space-y-4 rounded-[var(--radius-card)] border p-4"
                    key={index}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">
                        Ingredient {index + 1}
                      </h3>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ingredient ${index + 1} up`}
                          title="Move up"
                          disabled={index === 0}
                          onClick={() =>
                            setIngredients((current) =>
                              moveItem(current, index, -1),
                            )
                          }
                        >
                          <ArrowUp size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ingredient ${index + 1} down`}
                          title="Move down"
                          disabled={index === ingredients.length - 1}
                          onClick={() =>
                            setIngredients((current) =>
                              moveItem(current, index, 1),
                            )
                          }
                        >
                          <ArrowDown size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setIngredients((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ingredient-line-${index}`}>
                        Original ingredient line
                      </Label>
                      <Textarea
                        id={`ingredient-line-${index}`}
                        value={ingredient.originalText}
                        onChange={(event) =>
                          updateIngredient(index, {
                            originalText: event.target.value,
                          })
                        }
                        placeholder="2 yellow onions, diced"
                        required
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`ingredient-quantity-${index}`}>
                          Quantity{' '}
                          <span className="text-muted-foreground">
                            (optional)
                          </span>
                        </Label>
                        <Input
                          id={`ingredient-quantity-${index}`}
                          value={ingredient.quantity ?? ''}
                          onChange={(event) =>
                            updateIngredient(index, {
                              quantity: event.target.value,
                            })
                          }
                          placeholder="2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`ingredient-unit-${index}`}>
                          Unit{' '}
                          <span className="text-muted-foreground">
                            (optional)
                          </span>
                        </Label>
                        <Input
                          id={`ingredient-unit-${index}`}
                          value={ingredient.unit ?? ''}
                          onChange={(event) =>
                            updateIngredient(index, {
                              unit: event.target.value,
                            })
                          }
                          placeholder="lb, cup, or each"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ingredient-name-${index}`}>
                        Ingredient name
                      </Label>
                      <Input
                        id={`ingredient-name-${index}`}
                        value={ingredient.ingredientName}
                        onChange={(event) =>
                          updateIngredient(index, {
                            ingredientName: event.target.value,
                          })
                        }
                        placeholder="Yellow onions"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ingredient-preparation-${index}`}>
                        Preparation note{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id={`ingredient-preparation-${index}`}
                        value={ingredient.preparationNote ?? ''}
                        onChange={(event) =>
                          updateIngredient(index, {
                            preparationNote: event.target.value,
                          })
                        }
                        placeholder="diced"
                      />
                    </div>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <Checkbox
                        checked={ingredient.optional}
                        onChange={(event) =>
                          updateIngredient(index, {
                            optional: event.target.checked,
                          })
                        }
                      />
                      Optional ingredient
                    </label>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setIngredients((current) => [...current, blankIngredient()])
                  }
                >
                  Add ingredient
                </Button>
              </fieldset>
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium">Instructions</legend>
                <p className="text-muted-foreground text-xs">
                  Add one concise step at a time. Use the move buttons to keep
                  the cooking order clear; they work with a keyboard too.
                </p>
                {instructions.map((instruction, index) => (
                  <div
                    className="border-border space-y-3 rounded-[var(--radius-card)] border p-4"
                    key={index}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">Step {index + 1}</h3>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Move step ${index + 1} up`}
                          title="Move up"
                          disabled={index === 0}
                          onClick={() =>
                            setInstructions((current) =>
                              moveItem(current, index, -1),
                            )
                          }
                        >
                          <ArrowUp size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Move step ${index + 1} down`}
                          title="Move down"
                          disabled={index === instructions.length - 1}
                          onClick={() =>
                            setInstructions((current) =>
                              moveItem(current, index, 1),
                            )
                          }
                        >
                          <ArrowDown size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setInstructions((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <Label htmlFor={`instruction-${index}`}>
                      Instruction {index + 1}
                    </Label>
                    <Textarea
                      id={`instruction-${index}`}
                      value={instruction}
                      onChange={(event) =>
                        setInstructions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder="Simmer until the onions are tender."
                      required
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInstructions((current) => [...current, ''])}
                >
                  Add instruction
                </Button>
              </fieldset>
            </>
          )}
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="ghost" type="button" asChild>
              <Link href="/my-recipes">
                <ArrowLeft size={16} />
                Back to my recipes
              </Link>
            </Button>
            <Button disabled={busy} type="submit">
              <Save size={16} />
              {busy ? 'Saving…' : recipeId ? 'Save changes' : 'Save draft'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
