'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const complaintTypes = [
  { value: 'copyright', label: 'Copyright concern' },
  { value: 'source-removal', label: 'Source removal request' },
  { value: 'incorrect-attribution', label: 'Incorrect attribution' },
  { value: 'other', label: 'Other public-content concern' },
] as const

export function ComplaintForm({
  initialRecipeId = '',
  initialSourceUrl = '',
}: {
  initialRecipeId?: string
  initialSourceUrl?: string
}) {
  const [type, setType] = React.useState('copyright')
  const [recipeId, setRecipeId] = React.useState(initialRecipeId)
  const [sourceUrl, setSourceUrl] = React.useState(initialSourceUrl)
  const [description, setDescription] = React.useState('')
  const [contactName, setContactName] = React.useState('')
  const [contactEmail, setContactEmail] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/v1/complaints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type,
          recipeId,
          sourceUrl,
          description,
          contactName,
          contactEmail,
        }),
      })
      const body = (await response.json()) as {
        complaint?: { status: string }
        detail?: string
      }
      if (!response.ok || !body.complaint) {
        throw new Error(body.detail ?? 'The report could not be submitted.')
      }
      setMessage(
        'Your report was received. An operator will review the public content and may contact you if needed.',
      )
      setDescription('')
      setContactName('')
      setContactEmail('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Submit a removal request</CardTitle>
        <p className="text-muted-foreground text-sm">
          Identify the public recipe or source and explain what an operator
          should review. A contact email is optional.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="complaint-type">
              Report type
            </label>
            <select
              className="bg-background focus:ring-ring min-h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm outline-none focus:ring-2"
              id="complaint-type"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              {complaintTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="complaint-recipe">
              Public recipe ID{' '}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="complaint-recipe"
              onChange={(event) => setRecipeId(event.target.value)}
              placeholder="Paste the recipe ID"
              value={recipeId}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="complaint-source">
              Source URL{' '}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="complaint-source"
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com/recipe"
              type="url"
              value={sourceUrl}
            />
            <p className="text-muted-foreground text-xs">
              Provide a public recipe ID or source URL. Do not include sign-in
              links or private content.
            </p>
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="complaint-description"
            >
              What should we review?
            </label>
            <Textarea
              id="complaint-description"
              maxLength={4000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the material and your relationship to it."
              required
              value={description}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              Reply contact (optional)
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="complaint-name"
                >
                  Name
                </label>
                <Input
                  id="complaint-name"
                  onChange={(event) => setContactName(event.target.value)}
                  value={contactName}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="complaint-email"
                >
                  Email
                </label>
                <Input
                  id="complaint-email"
                  onChange={(event) => setContactEmail(event.target.value)}
                  type="email"
                  value={contactEmail}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Contact details are used only for this review and stay out of
              public recipe responses and general application logs.
            </p>
          </fieldset>

          <Button disabled={pending} type="submit">
            {pending ? 'Submitting report…' : 'Submit report'}
          </Button>
          <p aria-live="polite" className="text-muted-foreground text-sm">
            {error ?? message}
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
