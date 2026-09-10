import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export default async function RecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}) {
  const { recipeId } = await params
  const title = recipeId === 'curry' ? 'Weeknight curry' : 'Tacos'
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Public recipe"
        title={title}
        description="A versioned recipe detail placeholder with source and attribution kept visible."
        action={<Button>Add to this week</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <p className="text-muted-foreground text-sm">
              Typical yield: 4 people
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-data">1 lb</span>
              <span>ground meat</span>
            </div>
            <div className="flex justify-between">
              <span className="font-data">2</span>
              <span>yellow onions</span>
            </div>
            <div className="flex justify-between">
              <span className="font-data">1 cup</span>
              <span>tomatoes</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Source and attribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant="outline">Version 1</Badge>
            <p>Source: Platter community</p>
            <p className="text-muted-foreground">
              This synthetic fixture demonstrates the source and image-license
              state. It is not recipe content.
            </p>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  )
}
