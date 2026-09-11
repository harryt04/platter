'use client'

import * as React from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type {
  RecipeImportStatus,
  RecipeImportSummary,
} from '@/lib/recipe-imports'

const statusLabel: Record<RecipeImportStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  retrying: 'Retrying',
  failed: 'Failed',
  'preview-ready': 'Preview ready',
}

const statusDescription: Record<RecipeImportStatus, string> = {
  queued: 'Waiting for the import worker to start.',
  processing: 'Reading the public recipe page.',
  retrying: 'The first attempt did not finish. Platter will try again.',
  failed: 'This URL could not be imported. You can submit it again.',
  'preview-ready': 'Review the extracted recipe before saving it.',
}

function StatusIcon({ status }: { status: RecipeImportStatus }) {
  if (status === 'failed') return <AlertCircle aria-hidden size={16} />
  if (status === 'preview-ready') return <CheckCircle2 aria-hidden size={16} />
  if (status === 'processing' || status === 'retrying') {
    return <LoaderCircle aria-hidden className="animate-spin" size={16} />
  }
  return <Clock3 aria-hidden size={16} />
}

function subscribeToOnlineStatus(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function getOnlineStatus() {
  return navigator.onLine
}

function getServerOnlineStatus() {
  return true
}

export function RecipeImportForm({
  initialImports,
  importsEnabled = true,
}: {
  initialImports: RecipeImportSummary[]
  importsEnabled?: boolean
}) {
  const router = useRouter()
  const [imports, setImports] = React.useState(initialImports)
  const [sourceUrl, setSourceUrl] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [pendingRecovery, setPendingRecovery] = React.useState<string | null>(
    null,
  )
  const online = React.useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  )
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (
      !imports.some(({ status }) =>
        ['queued', 'processing', 'retrying'].includes(status),
      )
    ) {
      return
    }
    const timer = window.setInterval(async () => {
      if (!navigator.onLine) return
      const current = await Promise.all(
        imports.map(async (item) => {
          if (!['queued', 'processing', 'retrying'].includes(item.status)) {
            return item
          }
          const response = await fetch(`/api/v1/imports/${item.id}`)
          if (!response.ok) return item
          const body = (await response.json()) as {
            import?: RecipeImportSummary
          }
          return body.import ?? item
        }),
      )
      setImports(current)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [imports])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!navigator.onLine) {
      setError('Reconnect to the internet before importing a recipe URL.')
      return
    }
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/v1/imports', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({ sourceUrl }),
      })
      const body = (await response.json()) as {
        detail?: string
        import?: RecipeImportSummary
      }
      if (!response.ok || !body.import) {
        throw new Error(body.detail ?? 'The recipe URL could not be queued.')
      }
      setImports((current) => [body.import!, ...current])
      setSourceUrl('')
      setMessage(
        'Import queued. This page will update when the preview is ready.',
      )
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  async function recoverImport(
    item: RecipeImportSummary,
    action: 'retry' | 'reprocess',
  ) {
    setPendingRecovery(item.id)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(`/api/v1/imports/${item.id}/retry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = (await response.json()) as {
        detail?: string
        import?: RecipeImportSummary
      }
      if (!response.ok || !body.import) {
        throw new Error(body.detail ?? 'The import could not be queued.')
      }
      setImports((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? body.import! : currentItem,
        ),
      )
      setMessage(
        action === 'retry'
          ? 'Retry queued. This page will update with the result.'
          : 'Source refresh queued. Your saved recipe will not be duplicated.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPendingRecovery(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Start with a public recipe URL</CardTitle>
          <p className="text-muted-foreground text-sm">
            Platter will fetch the page in the background and prepare an
            editable preview. Saving the preview never adds it to a shopping run
            automatically.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="recipe-import-url"
              >
                Recipe URL
              </label>
              <Input
                disabled={pending || !online || !importsEnabled}
                id="recipe-import-url"
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://example.com/recipe"
                required
                type="url"
                value={sourceUrl}
              />
              <p className="text-muted-foreground text-xs">
                Only public HTTP or HTTPS pages can be submitted. Do not include
                sign-in links or private content.
              </p>
            </div>
            {!online && (
              <p className="text-warning text-sm" role="status">
                You are offline. URL imports require a connection and are not
                queued offline.
              </p>
            )}
            {!importsEnabled && (
              <p className="text-muted-foreground text-sm" role="status">
                Public URL imports are disabled by the instance operator. Manual
                recipes, existing saved recipes, and shopping remain available.
              </p>
            )}
            <Button
              disabled={
                pending || !online || !importsEnabled || !sourceUrl.trim()
              }
              type="submit"
            >
              {pending ? 'Queueing import…' : 'Import recipe URL'}
            </Button>
            <p aria-live="polite" className="text-muted-foreground text-sm">
              {error ?? message}
            </p>
          </form>
        </CardContent>
      </Card>

      <section
        aria-labelledby="recipe-import-status-heading"
        className="space-y-3"
      >
        <h2 className="text-lg font-semibold" id="recipe-import-status-heading">
          Your imports
        </h2>
        {imports.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-sm">
                Submitted imports will appear here with their current status.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {imports.map((item) => (
              <li key={item.id}>
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className="font-data max-w-full truncate text-sm"
                        title={item.sourceUrl}
                      >
                        {item.sourceUrl}
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        <StatusIcon status={item.status} />
                        {statusLabel[item.status]}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {statusDescription[item.status]}
                      {item.failureCode ? ` (${item.failureCode})` : ''}
                    </p>
                    {item.status === 'preview-ready' && item.preview && (
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          className="text-primary inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                          href={`/import/${item.id}`}
                        >
                          {item.savedRecipeId
                            ? 'Open saved import'
                            : 'Review extracted recipe'}
                        </Link>
                        <Button
                          disabled={
                            pendingRecovery === item.id ||
                            !online ||
                            !importsEnabled
                          }
                          onClick={() => recoverImport(item, 'reprocess')}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RefreshCw aria-hidden size={16} />
                          Refresh source
                        </Button>
                      </div>
                    )}
                    {item.status === 'failed' && (
                      <Button
                        disabled={
                          pendingRecovery === item.id ||
                          !online ||
                          !importsEnabled
                        }
                        onClick={() => recoverImport(item, 'retry')}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCw aria-hidden size={16} />
                        Retry import
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
