import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { listMemberFilter, type ListDocument } from '@/lib/lists'
import { notFound } from 'next/navigation'
import { RenameListForm } from '@/components/lists/rename-list-form'
import { LeaveListButton } from '@/components/lists/leave-list-button'

export default async function ListPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}`)
  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listMemberFilter(listId, session.user.id))
  if (!list) notFound()

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="List"
        title={list.name}
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
              <Badge variant="outline">None selected</Badge>
            </div>
            <div className="flex justify-between">
              <span>Grocery items</span>
              <span className="font-data">0</span>
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
            <p className="text-muted-foreground">No recipes selected yet.</p>
            <Link
              className="text-primary inline-block min-h-11 pt-3"
              href="/discover"
            >
              Choose another recipe
            </Link>
          </CardContent>
        </Card>
      </div>
      {list.ownerIds.includes(session.user.id) && (
        <div className="mt-6 max-w-2xl">
          <RenameListForm listId={listId} currentName={list.name} />
        </div>
      )}
      {list.members.some(
        (member) =>
          member.userId === session.user.id && member.role === 'editor',
      ) && (
        <div className="mt-6 max-w-2xl">
          <LeaveListButton listId={listId} listName={list.name} />
        </div>
      )}
    </ContentContainer>
  )
}
