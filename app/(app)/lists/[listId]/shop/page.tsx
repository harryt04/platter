import { GroceryRow } from '@/components/patterns/grocery-row'
import { SyncStatus } from '@/components/states/sync-status'
import { Button } from '@/components/ui/button'
import {
  ContentContainer,
  PageHeader,
  PageSection,
} from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { findListForMember, listAcceptsShoppingOperations } from '@/lib/lists'
import { notFound } from 'next/navigation'

export default async function ShopPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}/shop`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  const isReadOnly = !listAcceptsShoppingOperations(list)

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Shopping run"
        description="Mark each item purchased as you move through the store."
        action={
          <Button disabled={isReadOnly}>
            {isReadOnly
              ? 'Shopping unavailable while archived'
              : 'Complete shopping run'}
          </Button>
        }
      />
      {isReadOnly && (
        <p className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 rounded-[var(--radius-card)] border p-4 text-sm">
          This list is archived. The shopping run is read-only until an owner
          unarchives it.
        </p>
      )}
      <div className="mb-6">
        <SyncStatus state="synced" />
      </div>
      <PageSection title="Produce">
        <div className="space-y-3">
          <GroceryRow
            ingredient="yellow onions"
            amount="2"
            category="Produce"
          />
          <GroceryRow
            ingredient="tomatoes"
            amount="1 cup"
            category="Produce"
            state="purchased"
          />
        </div>
      </PageSection>
      <PageSection title="Meat">
        <GroceryRow ingredient="ground meat" amount="2 lb" category="Meat" />
      </PageSection>
    </ContentContainer>
  )
}
