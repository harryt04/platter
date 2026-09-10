import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { findListForMember } from '@/lib/lists'
import { notFound } from 'next/navigation'
import { RenameListForm } from '@/components/lists/rename-list-form'
import { LeaveListButton } from '@/components/lists/leave-list-button'
import { ListLifecycleActions } from '@/components/lists/list-lifecycle-actions'

export default async function ListPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}`)
  const list = await findListForMember(listId, session.user.id)
  if (!list || list.status === 'deleted') notFound()

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="List"
        title={list.name}
        description="Your current recipe selections and shopping run summary."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/lists/${listId}/members`}>Manage members</Link>
            </Button>
            {list.status === 'active' ? (
              <Button asChild>
                <Link href={`/lists/${listId}/review`}>Review at home</Link>
              </Button>
            ) : (
              <Badge variant="outline">Archived</Badge>
            )}
          </div>
        }
      />
      {list.status === 'archived' && (
        <p className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 rounded-[var(--radius-card)] border p-4 text-sm">
          This list is archived. Its shared shopping run is read-only until an
          owner unarchives it.
        </p>
      )}
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
            {list.status === 'active' ? (
              <Button className="w-full" asChild>
                <Link href={`/lists/${listId}/shop`}>Start shopping</Link>
              </Button>
            ) : (
              <Button className="w-full" disabled>
                Shopping unavailable while archived
              </Button>
            )}
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
        <>
          <div className="mt-6 max-w-2xl">
            <RenameListForm listId={listId} currentName={list.name} />
          </div>
          <div className="mt-6 max-w-2xl">
            <ListLifecycleActions
              listId={listId}
              listName={list.name}
              status={list.status}
            />
          </div>
        </>
      )}
      {list.members.some((member) => member.userId === session.user.id) && (
        <div className="mt-6 max-w-2xl">
          <LeaveListButton
            listId={listId}
            listName={list.name}
            canLeave={
              !list.ownerIds.includes(session.user.id) ||
              list.ownerIds.length > 1
            }
          />
        </div>
      )}
    </ContentContainer>
  )
}
