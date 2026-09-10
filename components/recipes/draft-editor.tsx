'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
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
import type { RecipeIngredient } from '@/lib/recipes/drafts'

type IngredientForm = RecipeIngredient

const blankIngredient = (): IngredientForm => ({
  originalText: '',
  quantity: '',
  unit: '',
  ingredientName: '',
  preparationNote: '',
  optional: false,
})

export function DraftEditor({
  recipeId,
  initialTitle = '',
  initialDescription = '',
  initialTypicalPeopleFed,
  initialIngredients = [],
}: {
  recipeId?: string
  initialTitle?: string
  initialDescription?: string
  initialTypicalPeopleFed?: number
  initialIngredients?: RecipeIngredient[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [typicalPeopleFed, setTypicalPeopleFed] = useState(
    initialTypicalPeopleFed?.toString() ?? '',
  )
  const [ingredients, setIngredients] =
    useState<IngredientForm[]>(initialIngredients)
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
                  ingredients,
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
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
