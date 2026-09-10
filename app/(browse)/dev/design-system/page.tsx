import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GroceryRow } from '@/components/patterns/grocery-row'
import { ContributionDetail } from '@/components/patterns/contribution-detail'
import { ManualOverride } from '@/components/patterns/manual-override'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Development gallery"
        title="Design system"
        description="Token, type, state, and shell references for foundation work."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Buttons and badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>Primary action</Button>
            <Button variant="outline">Secondary action</Button>
            <Button variant="ghost">Quiet action</Button>
            <Button variant="secondary">Marigold signal</Button>
            <Badge>Public</Badge>
            <Badge variant="success">Synced</Badge>
            <Badge variant="warning">Review</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl">
              Fraunces display with Instrument Sans UI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-data">2 lb · 1 cup · Version 3</p>
          </CardContent>
        </Card>
        <GroceryRow ingredient="yellow onions" amount="2" />
        <ContributionDetail />
        <ManualOverride />
      </div>
    </ContentContainer>
  )
}
