'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AccountDeletionImpact } from '@/lib/account-deletion'

function ImpactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0">
      <dt className="text-sm">{label}</dt>
      <dd className="font-data text-right text-sm font-medium tabular-nums">
        {value}
      </dd>
    </div>
  )
}

export function AccountDeletionImpactPanel() {
  const [impact, setImpact] = useState<AccountDeletionImpact | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchImpact = useCallback(async () => {
    const response = await fetch('/api/v1/account/deletion-impact')
    const result = (await response.json()) as {
      impact?: AccountDeletionImpact
      detail?: string
    }
    if (!response.ok || !result.impact) {
      throw new Error(
        result.detail ?? 'We couldn’t load the account deletion details.',
      )
    }
    return result.impact
  }, [])

  const loadImpact = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setImpact(await fetchImpact())
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t load the account deletion details.',
      )
    } finally {
      setLoading(false)
    }
  }, [fetchImpact])

  useEffect(() => {
    let mounted = true
    void fetchImpact()
      .then((nextImpact) => {
        if (!mounted) return
        setImpact(nextImpact)
        setError('')
      })
      .catch((caught: unknown) => {
        if (!mounted) return
        setError(
          caught instanceof Error
            ? caught.message
            : 'We couldn’t load the account deletion details.',
        )
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [fetchImpact])

  return (
    <Card className="border-destructive/50 max-w-2xl">
      <CardHeader>
        <CardTitle>Before you delete your account</CardTitle>
        <CardDescription>
          Review what is connected to this account before the confirmation step.
          No deletion starts from this summary.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm" role="status">
            Loading deletion details…
          </p>
        ) : error ? (
          <div className="space-y-3" role="alert">
            <p className="text-destructive text-sm">{error}</p>
            <Button type="button" variant="outline" onClick={loadImpact}>
              Try again
            </Button>
          </div>
        ) : impact ? (
          <dl>
            <ImpactRow label="Owned lists" value={impact.ownedLists} />
            <ImpactRow
              label="Lists where you are the only owner"
              value={impact.soleOwnerLists.length}
            />
            <ImpactRow label="List memberships" value={impact.memberships} />
            <ImpactRow
              label="Manually authored recipes"
              value={impact.manuallyAuthoredRecipes}
            />
            <ImpactRow
              label="Public imported recipes"
              value={impact.publicImportedRecipes}
            />
            <ImpactRow
              label="Completed shopping runs"
              value={impact.completedShoppingRuns}
            />
            {impact.soleOwnerLists.length > 0 && (
              <div className="border-warning/40 bg-warning/10 mt-4 space-y-3 rounded-[var(--radius-card)] border p-4">
                <p className="text-sm">
                  You are the only owner of{' '}
                  {impact.soleOwnerLists.length === 1
                    ? `“${impact.soleOwnerLists[0]}”`
                    : `${impact.soleOwnerLists.length} lists`}
                  . Transfer ownership or delete each list before account
                  deletion can proceed.
                </p>
                <ul
                  className="space-y-3"
                  aria-label="Lists needing ownership changes"
                >
                  {impact.soleOwnerListDetails.map((list) => (
                    <li
                      className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"
                      key={list.listId}
                    >
                      <span className="text-sm font-medium">
                        {list.listName}
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Link
                          className="text-primary inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                          href={`/lists/${encodeURIComponent(list.listId)}/members`}
                        >
                          Transfer ownership
                        </Link>
                        <Link
                          className="text-primary inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                          href={`/lists/${encodeURIComponent(list.listId)}`}
                        >
                          Delete list
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  )
}
