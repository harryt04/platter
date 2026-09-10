import { GroceryRow } from '@/components/patterns/grocery-row'
import { SyncStatus } from '@/components/states/sync-status'
import { Button } from '@/components/ui/button'
import {
  ContentContainer,
  PageHeader,
  PageSection,
} from '@/components/shell/page-header'

export default async function ShopPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  return (
    <ContentContainer>
      <PageHeader
        eyebrow={listId === 'personal' ? 'Personal list' : 'Family list'}
        title="Shopping run"
        description="Mark each item purchased as you move through the store."
        action={<Button>Complete shopping run</Button>}
      />
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
