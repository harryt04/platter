'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SavePublicRecipeButton({
  recipeId,
  initialSaved,
}: {
  recipeId: string
  initialSaved: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = React.useState(initialSaved)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function toggleSaved() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/recipes/${recipeId}/save`, {
        method: saved ? 'DELETE' : 'POST',
      })
      if (!response.ok) throw new Error('The save could not be changed.')
      setSaved(!saved)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        aria-pressed={saved}
        disabled={pending}
        onClick={toggleSaved}
        type="button"
        variant="outline"
      >
        {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        {saved ? 'Saved to my recipes' : 'Save to my recipes'}
      </Button>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {error ??
          (saved
            ? 'Available in your recipe library without adding it to a shopping run.'
            : 'Save this public recipe without adding it to a shopping run.')}
      </p>
    </div>
  )
}
