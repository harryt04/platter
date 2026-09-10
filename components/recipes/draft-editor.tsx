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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DraftEditor({
  recipeId,
  initialTitle = '',
}: {
  recipeId?: string
  initialTitle?: string
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
          body: JSON.stringify({ title }),
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
              Private until you choose to share or publish it.
            </p>
          </div>
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
