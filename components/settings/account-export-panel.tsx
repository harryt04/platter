'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AccountExportSummary } from '@/lib/account-exports'

export function AccountExportPanel() {
  const [exportSummary, setExportSummary] =
    useState<AccountExportSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function requestExport() {
    setBusy(true)
    setError('')
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
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        {exportSummary ? (
          <div className="space-y-2" role="status">
            <p className="text-sm">Your export is ready to download.</p>
            <Button asChild>
              <a href={exportSummary.downloadUrl}>Download account export</a>
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
