import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { EmptyState } from '@/components/states/empty-state'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listMembershipFilter,
  toPlatterList,
  type ListDocument,
} from '@/lib/lists'

export default async function ListsPage() {
  const session = await requireSession('/lists')
  const db = await getConnectedDatabase()
  const documents = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(session.user.id))
    .sort({ updatedAt: -1 })
    .toArray()
  const lists = documents.map(toPlatterList)

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
      {lists.length === 0 ? (
        <EmptyState
          title="You have no lists yet"
          description="Create a list for a household, group, or personal shopping run."
          action="Create a list"
          href="/lists/new"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lists.map((list) => (
            <Card key={list.id}>
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  {list.name}
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  {list.members.length === 1
                    ? 'Just you'
                    : `${list.members.length} members`}{' '}
                  · Empty shopping run
                </p>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link href={`/lists/${list.id}`}>
                    Open list <ArrowRight size={16} />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ContentContainer>
  )
}
