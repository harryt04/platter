'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { type AccountExportSummary } from '@/lib/account-exports'
import { formatAccountExportExpiry } from '@/lib/account'

export function AccountExportPanel({ locale = 'en-US' }: { locale?: string }) {
  const [exportSummary, setExportSummary] =
    useState<AccountExportSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState<number | null>(null)

  useEffect(() => {
    if (!exportSummary) return

    const remaining = new Date(exportSummary.expiresAt).getTime() - Date.now()
    if (remaining <= 0) return
    const timeout = window.setTimeout(
      () => setCurrentTime(Date.now()),
      remaining,
    )
    return () => window.clearTimeout(timeout)
  }, [exportSummary])

  const expired =
    exportSummary !== null &&
    currentTime !== null &&
    new Date(exportSummary.expiresAt).getTime() <= currentTime

  async function requestExport() {
    setBusy(true)
    setError('')
    setExportSummary(null)
    setCurrentTime(null)
    try {
      const response = await fetch('/api/v1/account/exports', {
        method: 'POST',
      })
      const result = (await response.json()) as {
        export?: AccountExportSummary
        detail?: string
      }
      if (!response.ok || !result.export) {
        throw new Error(result.detail ?? 'We couldn’t prepare your export.')
      }
      setCurrentTime(Date.now())
      setExportSummary(result.export)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t prepare your export.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Account data</CardTitle>
        <CardDescription>
          Download a copy of your profile, list memberships, recipes, saved
          references, imports, and shopping history. The file is private and
          available for 24 hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="space-y-3" role="alert">
            <p className="text-destructive text-sm">{error}</p>
            <Button type="button" variant="outline" onClick={requestExport}>
              Try again
            </Button>
          </div>
        )}
        {exportSummary && !expired ? (
          <div className="space-y-2" role="status">
            <p className="text-sm">Your export is ready to download.</p>
            <p className="text-muted-foreground text-sm">
              Available until{' '}
              <time dateTime={exportSummary.expiresAt}>
                {formatAccountExportExpiry(exportSummary.expiresAt, locale)}
              </time>
              .
            </p>
            <Button asChild>
              <a href={exportSummary.downloadUrl}>Download account export</a>
            </Button>
          </div>
        ) : exportSummary && expired ? (
          <div className="space-y-3" role="status">
            <p className="text-sm">
              This export expired. Prepare a new export to download your data.
            </p>
            <Button type="button" onClick={requestExport} disabled={busy}>
              {busy ? 'Preparing export…' : 'Prepare a new export'}
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={requestExport} disabled={busy}>
            {busy ? 'Preparing export…' : 'Prepare account export'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
