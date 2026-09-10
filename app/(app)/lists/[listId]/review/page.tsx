import { GroceryRow } from '@/components/patterns/grocery-row'
import { ContributionDetail } from '@/components/patterns/contribution-detail'
import { ManualOverride } from '@/components/patterns/manual-override'
import {
  ContentContainer,
  PageHeader,
  PageSection,
} from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { findListForMember, listAcceptsShoppingOperations } from '@/lib/lists'
import { notFound } from 'next/navigation'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}/review`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  const isReadOnly = !listAcceptsShoppingOperations(list)

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Review at home"
        description="Check what you already have before you start shopping. The source recipes stay unchanged."
      />
      {isReadOnly && (
        <p className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 rounded-[var(--radius-card)] border p-4 text-sm">
          This list is archived. The shopping run is read-only until an owner
          unarchives it.
        </p>
      )}
      <PageSection title="Grocery items">
        <div className="space-y-3">
          <GroceryRow
            ingredient="yellow onions"
            amount="2"
            category="Produce"
          />
          <GroceryRow
            ingredient="ground meat"
            amount="2 lb"
            category="Meat"
            state="already-have"
          />
        </div>
      </PageSection>
      <div className="grid gap-6 lg:grid-cols-2">
        <ContributionDetail />
        <ManualOverride disabled={isReadOnly} />
      </div>
    </ContentContainer>
  )
}
