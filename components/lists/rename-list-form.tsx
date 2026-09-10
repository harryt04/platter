'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export function RenameListForm({
  listId,
  currentName,
}: {
  listId: string
  currentName: string
}) {
  const router = useRouter()
  const [name, setName] = useState(currentName)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setConfirmation('')
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        },
      )
      if (!response.ok) {
        const problem = (await response.json()) as { detail?: string }
        throw new Error(problem.detail ?? 'We couldn’t rename this list.')
      }
      const result = (await response.json()) as { list: { name: string } }
      setName(result.list.name)
      setConfirmation(`Renamed “${result.list.name}”.`)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t rename this list.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>List name</CardTitle>
        <CardDescription>
          Only owners can change this name for everyone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={rename}>
          <div className="space-y-2">
            <Label htmlFor="list-name">List name</Label>
            <Input
              id="list-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          {confirmation && (
            <p className="text-success text-sm" role="status">
              {confirmation}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? 'Saving…' : 'Save name'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
