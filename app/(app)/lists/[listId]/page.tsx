import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export default async function ListPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const name = listId === 'personal' ? 'Personal' : 'Family'
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="List"
        title={name}
        description="Your current recipe selections and shopping run summary."
        action={
          <Button asChild>
            <Link href={`/lists/${listId}/review`}>Review at home</Link>
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current shopping run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Recipes</span>
              <Badge variant="outline">2 selected</Badge>
            </div>
            <div className="flex justify-between">
              <span>Grocery items</span>
              <span className="font-data">8</span>
            </div>
            <Button className="w-full" asChild>
              <Link href={`/lists/${listId}/shop`}>Start shopping</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Selected recipes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Tacos · 4 people</p>
            <p>Curry · 2 people</p>
            <Link
              className="text-primary inline-block min-h-11 pt-3"
              href="/discover"
            >
              Choose another recipe
            </Link>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  )
}
