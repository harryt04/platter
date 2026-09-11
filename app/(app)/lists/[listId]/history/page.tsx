import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/states/empty-state'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { findListForMember, listIdSchema } from '@/lib/lists'
import {
  decodeShoppingRunHistoryCursor,
  formatShoppingRunHistoryDate,
  searchShoppingRunHistory,
} from '@/lib/shopping-run-history'
import { notFound } from 'next/navigation'

type SearchParams = { cursor?: string }

export default async function ListHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>
  searchParams?: Promise<SearchParams>
}) {
  const { listId } = await params
  if (!listIdSchema.safeParse(listId).success) notFound()
  const session = await requireSession(`/lists/${listId}/history`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  const db = await getConnectedDatabase()
  const paramsForPage = (await searchParams) ?? {}
  const cursor =
    paramsForPage.cursor && decodeShoppingRunHistoryCursor(paramsForPage.cursor)
      ? paramsForPage.cursor
      : undefined
  const page = await searchShoppingRunHistory(db, listId, { cursor })
  const nextPageHref = page.nextCursor
    ? `/lists/${listId}/history?${new URLSearchParams({
        cursor: page.nextCursor,
      }).toString()}`
    : undefined

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Completed runs"
        description="See which recipes this list shopped for and when. This is not a record of what was cooked or purchased."
        action={
          <Button variant="outline" asChild>
            <Link href={`/lists/${listId}`}>Back to list</Link>
          </Button>
        }
      />
      {page.entries.length === 0 ? (
        <EmptyState
          title="No completed shopping runs"
          description="Complete a shopping run to keep its recipe and date in this list’s history."
          action="Open shopping run"
          href={`/lists/${listId}`}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {page.entries.map((entry) => (
              <Card key={entry._id}>
                <CardHeader>
                  <p className="font-data text-muted-foreground text-xs tracking-widest uppercase">
                    Shopped for
                  </p>
                  <CardTitle className="font-display text-2xl">
                    <Link
                      className="hover:text-primary focus-visible:text-primary underline-offset-4 hover:underline focus-visible:underline"
                      href={`/lists/${listId}/history/${entry._id}`}
                    >
                      <time dateTime={entry.localDate}>
                        {formatShoppingRunHistoryDate(
                          entry.localDate,
                          session.user.locale ?? 'en-US',
                        )}
                      </time>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  {entry.recipeSelections.length === 1
                    ? '1 recipe selected'
                    : `${entry.recipeSelections.length} recipes selected`}
                </CardContent>
              </Card>
            ))}
          </div>
          {nextPageHref && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" asChild>
                <Link href={nextPageHref}>Next completed runs</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </ContentContainer>
  )
}
