import { GroceryRow } from '@/components/patterns/grocery-row'
import { ContributionDetail } from '@/components/patterns/contribution-detail'
import { ManualOverride } from '@/components/patterns/manual-override'
import {
  ContentContainer,
  PageHeader,
  PageSection,
} from '@/components/shell/page-header'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  return (
    <ContentContainer>
      <PageHeader
        eyebrow={listId === 'personal' ? 'Personal list' : 'Family list'}
        title="Review at home"
        description="Check what you already have before you start shopping. The source recipes stay unchanged."
      />
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
        <ManualOverride />
      </div>
    </ContentContainer>
  )
}
