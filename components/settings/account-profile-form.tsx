'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { profileLocaleOptions, type ProfileSummary } from '@/lib/account'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function AccountProfileForm({
  email,
  initialLocale,
  initialName,
}: {
  email: ProfileSummary['email']
  initialLocale: string
  initialName: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [locale, setLocale] = useState(initialLocale)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)

    try {
      const response = await fetch('/api/v1/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, locale }),
      })
      const result = (await response.json()) as {
        account?: ProfileSummary
        detail?: string
      }
      if (!response.ok || !result.account) {
        throw new Error(result.detail ?? 'We couldn’t save your profile.')
      }
      setName(result.account.name)
      setLocale(result.account.locale)
      setSaved(true)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t save your profile.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Profile details</CardTitle>
        <CardDescription>
          Your display name is shown to people you collaborate with.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="account-email">Email address</Label>
            <Input id="account-email" value={email} readOnly />
            <p className="text-muted-foreground text-sm">
              Email changes are handled through account recovery settings.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-name">Display name</Label>
            <Input
              id="account-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-locale">Locale</Label>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              id="account-locale"
              name="locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
            >
              {profileLocaleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-sm">
              Dates and supported unit presentation will follow this choice.
            </p>
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm" role="status">
              Your profile was saved.
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
