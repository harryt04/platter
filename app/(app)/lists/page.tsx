import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export default function ListsPage() {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Your lists"
        title="Choose a list"
        description="Each list has its own members, recipes, and current shopping run."
        action={
          <Button asChild>
            <Link href="/lists/new">
              <Plus size={16} />
              New list
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Family</CardTitle>
            <p className="text-muted-foreground text-sm">
              2 members · 2 recipes selected
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/lists/family">
                Open list <ArrowRight size={16} />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Personal</CardTitle>
            <p className="text-muted-foreground text-sm">
              Just you · Empty shopping run
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/lists/personal">
                Open list <ArrowRight size={16} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  )
}
