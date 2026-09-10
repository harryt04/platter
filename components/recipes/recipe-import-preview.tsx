'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { RecipeImportCandidate } from '@/lib/recipe-import-schema-org'
import type { RecipeIngredient } from '@/lib/recipes/drafts'

function blankIngredient(): RecipeIngredient {
  return {
    originalText: '',
    quantity: '',
    unit: '',
    ingredientName: '',
    preparationNote: '',
    optional: false,
  }
}

function moveItem<T>(items: T[], index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

function splitLabels(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function RecipeImportPreview({
  importId,
  candidate,
  savedRecipeId,
}: {
  importId: string
  candidate: RecipeImportCandidate
  savedRecipeId?: string
}) {
  const router = useRouter()
  const [title, setTitle] = React.useState(candidate.title ?? '')
  const [typicalPeopleFed, setTypicalPeopleFed] = React.useState(
    candidate.typicalPeopleFed?.toString() ?? '',
  )
  const [ingredients, setIngredients] = React.useState(candidate.ingredients)
  const [instructions, setInstructions] = React.useState(candidate.instructions)
  const [sourceName, setSourceName] = React.useState(candidate.sourceName ?? '')
  const [sourceUrl, setSourceUrl] = React.useState(candidate.sourceUrl)
  const [sourceAuthor, setSourceAuthor] = React.useState(
    candidate.sourceAuthor ?? '',
  )
  const [attribution, setAttribution] = React.useState(
    candidate.attribution ?? '',
  )
  const [prepTimeMinutes, setPrepTimeMinutes] = React.useState(
    candidate.prepTimeMinutes?.toString() ?? '',
  )
  const [cookingTimeMinutes, setCookingTimeMinutes] = React.useState(
    candidate.cookingTimeMinutes?.toString() ?? '',
  )
  const [totalTimeMinutes, setTotalTimeMinutes] = React.useState(
    candidate.totalTimeMinutes?.toString() ?? '',
  )
  const [cuisine, setCuisine] = React.useState(candidate.cuisine ?? '')
  const [mealType, setMealType] = React.useState(candidate.mealType ?? '')
  const [tags, setTags] = React.useState((candidate.tags ?? []).join(', '))
  const [dietaryLabels, setDietaryLabels] = React.useState(
    (candidate.dietaryLabels ?? []).join(', '),
  )
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [existingRecipe, setExistingRecipe] = React.useState<{
    id: string
    title: string
  } | null>(null)
  const [relatedRecipe, setRelatedRecipe] = React.useState<{
    id: string
    title: string
    versionNumber: number
    sourceUrl?: string
  } | null>(null)
  const [acceptedRelatedVersion, setAcceptedRelatedVersion] =
    React.useState(false)
  const timeFields = [
    {
      id: 'import-preview-prep-time',
      label: 'Prep time (minutes)',
      setValue: setPrepTimeMinutes,
      value: prepTimeMinutes,
    },
    {
      id: 'import-preview-cooking-time',
      label: 'Cooking time (minutes)',
      setValue: setCookingTimeMinutes,
      value: cookingTimeMinutes,
    },
    {
      id: 'import-preview-total-time',
      label: 'Total time (minutes)',
      setValue: setTotalTimeMinutes,
      value: totalTimeMinutes,
    },
  ]

  function updateIngredient(index: number, changes: Partial<RecipeIngredient>) {
    setIngredients((current) =>
      current.map((ingredient, itemIndex) =>
        itemIndex === index ? { ...ingredient, ...changes } : ingredient,
      ),
    )
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/imports/${importId}/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          typicalPeopleFed:
            typicalPeopleFed === '' ? null : Number(typicalPeopleFed),
          prepTimeMinutes:
            prepTimeMinutes === '' ? null : Number(prepTimeMinutes),
          cookingTimeMinutes:
            cookingTimeMinutes === '' ? null : Number(cookingTimeMinutes),
          totalTimeMinutes:
            totalTimeMinutes === '' ? null : Number(totalTimeMinutes),
          cuisine,
          mealType,
          sourceName,
          sourceUrl,
          sourceAuthor,
          attribution,
          tags: splitLabels(tags),
          dietaryLabels: splitLabels(dietaryLabels),
          ingredients,
          instructions,
          acceptRelatedVersion: acceptedRelatedVersion,
        }),
      })
      const body = (await response.json()) as {
        detail?: string
        recipe?: { id: string }
        recipeId?: string
        existingRecipe?: { id: string; title: string }
        relatedRecipe?: {
          id: string
          title: string
          versionNumber: number
          sourceUrl?: string
        }
      }
      if (!response.ok) {
        setExistingRecipe(body.existingRecipe ?? null)
        setRelatedRecipe(body.relatedRecipe ?? null)
        throw new Error(
          body.detail ?? 'The imported recipe could not be saved.',
        )
      }
      setExistingRecipe(null)
      setRelatedRecipe(null)
      const recipeId = body.recipe?.id ?? body.recipeId
      if (recipeId) router.push(`/recipes/${recipeId}/edit`)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The imported recipe could not be saved.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={save}>
      <Card>
        <CardHeader>
          <CardTitle>Review the extracted recipe</CardTitle>
          <p className="text-muted-foreground text-sm">
            We found recipe facts. Correct anything that needs attention before
            saving this as a private imported draft.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {candidate.warnings.length > 0 && (
            <div
              aria-label="Import warnings"
              className="border-warning/50 bg-warning/10 space-y-2 rounded-md border p-3 text-sm"
              role="status"
            >
              <p className="font-medium">
                Complete this imported recipe manually
              </p>
              <p>
                We preserved the safe recipe facts we could extract. Add or
                correct the missing fields below before saving.
              </p>
              <p className="font-medium">Review these missing source facts</p>
              <ul className="list-disc space-y-1 pl-5">
                {candidate.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="import-preview-title">Recipe title</Label>
            <Input
              id="import-preview-title"
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="import-preview-yield">Typical people fed</Label>
            <Input
              id="import-preview-yield"
              inputMode="numeric"
              min="1"
              onChange={(event) => setTypicalPeopleFed(event.target.value)}
              step="1"
              type="number"
              value={typicalPeopleFed}
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Source facts</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="import-preview-source-name">Source name</Label>
                <Input
                  id="import-preview-source-name"
                  onChange={(event) => setSourceName(event.target.value)}
                  value={sourceName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-preview-source-author">
                  Source author
                </Label>
                <Input
                  id="import-preview-source-author"
                  onChange={(event) => setSourceAuthor(event.target.value)}
                  value={sourceAuthor}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-preview-source-url">Source URL</Label>
              <Input
                id="import-preview-source-url"
                onChange={(event) => setSourceUrl(event.target.value)}
                type="url"
                value={sourceUrl}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-preview-attribution">Attribution</Label>
              <Textarea
                id="import-preview-attribution"
                onChange={(event) => setAttribution(event.target.value)}
                value={attribution}
              />
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipe details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {timeFields.map(({ id, label, setValue, value }) => {
              return (
                <div className="space-y-2" key={id}>
                  <Label htmlFor={id}>{label}</Label>
                  <Input
                    id={id}
                    min="0"
                    onChange={(event) => setValue(event.target.value)}
                    step="1"
                    type="number"
                    value={value}
                  />
                </div>
              )
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="import-preview-cuisine">Cuisine</Label>
              <Input
                id="import-preview-cuisine"
                onChange={(event) => setCuisine(event.target.value)}
                value={cuisine}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-preview-meal-type">Meal type</Label>
              <Input
                id="import-preview-meal-type"
                onChange={(event) => setMealType(event.target.value)}
                value={mealType}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="import-preview-tags">Tags</Label>
              <Input
                id="import-preview-tags"
                onChange={(event) => setTags(event.target.value)}
                value={tags}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-preview-dietary-labels">
                Dietary labels
              </Label>
              <Input
                id="import-preview-dietary-labels"
                onChange={(event) => setDietaryLabels(event.target.value)}
                value={dietaryLabels}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingredients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ingredients.length === 0 && (
            <p className="text-muted-foreground text-sm" role="status">
              No ingredients were extracted. Add the ingredients manually to
              save this recipe.
            </p>
          )}
          {ingredients.map((ingredient, index) => (
            <fieldset className="space-y-3 rounded-md border p-3" key={index}>
              <legend className="px-1 text-sm font-medium">
                Ingredient {index + 1}
              </legend>
              <div className="space-y-2">
                <Label htmlFor={`import-ingredient-line-${index}`}>
                  Original line
                </Label>
                <Input
                  id={`import-ingredient-line-${index}`}
                  onChange={(event) =>
                    updateIngredient(index, {
                      originalText: event.target.value,
                    })
                  }
                  required
                  value={ingredient.originalText}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['Quantity', 'quantity'],
                    ['Unit', 'unit'],
                    ['Ingredient name', 'ingredientName'],
                  ] as const
                ).map(([label, field]) => (
                  <div className="space-y-2" key={field}>
                    <Label htmlFor={`import-ingredient-${field}-${index}`}>
                      {label}
                    </Label>
                    <Input
                      id={`import-ingredient-${field}-${index}`}
                      onChange={(event) =>
                        updateIngredient(index, {
                          [field]: event.target.value,
                        })
                      }
                      required={field === 'ingredientName'}
                      value={ingredient[field] ?? ''}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`import-ingredient-note-${index}`}>
                  Preparation note
                </Label>
                <Input
                  id={`import-ingredient-note-${index}`}
                  onChange={(event) =>
                    updateIngredient(index, {
                      preparationNote: event.target.value,
                    })
                  }
                  value={ingredient.preparationNote ?? ''}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  aria-label={`Move ingredient ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() =>
                    setIngredients((items) => moveItem(items, index, -1))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowUp aria-hidden size={16} />
                  Move up
                </Button>
                <Button
                  aria-label={`Move ingredient ${index + 1} down`}
                  disabled={index === ingredients.length - 1}
                  onClick={() =>
                    setIngredients((items) => moveItem(items, index, 1))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowDown aria-hidden size={16} />
                  Move down
                </Button>
                <Button
                  onClick={() =>
                    setIngredients((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove ingredient
                </Button>
              </div>
            </fieldset>
          ))}
          <Button
            onClick={() =>
              setIngredients((items) => [...items, blankIngredient()])
            }
            type="button"
            variant="outline"
          >
            Add ingredient
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {instructions.length === 0 && (
            <p className="text-muted-foreground text-sm" role="status">
              No instructions were extracted. Add the cooking steps manually to
              save this recipe.
            </p>
          )}
          {instructions.map((instruction, index) => (
            <fieldset className="space-y-2 rounded-md border p-3" key={index}>
              <legend className="px-1 text-sm font-medium">
                Step {index + 1}
              </legend>
              <Textarea
                aria-label={`Instruction ${index + 1}`}
                onChange={(event) =>
                  setInstructions((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
                required
                value={instruction}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  aria-label={`Move instruction ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() =>
                    setInstructions((items) => moveItem(items, index, -1))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowUp aria-hidden size={16} />
                  Move up
                </Button>
                <Button
                  aria-label={`Move instruction ${index + 1} down`}
                  disabled={index === instructions.length - 1}
                  onClick={() =>
                    setInstructions((items) => moveItem(items, index, 1))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowDown aria-hidden size={16} />
                  Move down
                </Button>
                <Button
                  onClick={() =>
                    setInstructions((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove step
                </Button>
              </div>
            </fieldset>
          ))}
          <Button
            onClick={() => setInstructions((items) => [...items, ''])}
            type="button"
            variant="outline"
          >
            Add instruction
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Saving creates a private imported draft. It will not add anything to
          an active shopping run.
        </p>
        {savedRecipeId && (
          <p className="text-success text-sm" role="status">
            This import is already saved as a private recipe draft.
          </p>
        )}
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        {existingRecipe && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-muted-foreground text-sm">
              Existing recipe: {existingRecipe.title}
            </p>
            <Button asChild variant="outline">
              <Link href={`/recipes/${existingRecipe.id}`}>
                Open existing recipe
              </Link>
            </Button>
          </div>
        )}
        {relatedRecipe && (
          <div
            className="border-warning/50 bg-warning/10 space-y-3 rounded-md border p-3"
            role="alert"
          >
            <p className="font-medium">This source has changed</p>
            <p className="text-sm">
              The source matches {relatedRecipe.title}, version{' '}
              {relatedRecipe.versionNumber}, but its content fingerprint is
              different. Confirming will save a related immutable source
              version; it will not replace the existing recipe.
            </p>
            {relatedRecipe.sourceUrl && (
              <p className="font-data text-muted-foreground text-xs break-all">
                {relatedRecipe.sourceUrl}
              </p>
            )}
            <Button
              onClick={() => {
                setAcceptedRelatedVersion(true)
                setError(null)
              }}
              type="button"
              variant="outline"
            >
              Confirm related source version
            </Button>
          </div>
        )}
        <Button disabled={busy || Boolean(savedRecipeId)} type="submit">
          <Save aria-hidden size={16} />
          {busy
            ? 'Saving recipe…'
            : acceptedRelatedVersion
              ? 'Save related source version'
              : 'Save private recipe draft'}
        </Button>
      </div>
    </form>
  )
}
