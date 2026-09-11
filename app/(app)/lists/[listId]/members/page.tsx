import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { InvitationManagement } from '@/components/lists/invitation-management'
import { MemberManagement } from '@/components/lists/member-management'
import { findListForMember, listIdSchema } from '@/lib/lists'
import {
  invitations,
  toInvitationSummary,
  type InvitationDocument,
} from '@/lib/invitations'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { notFound } from 'next/navigation'
export default async function MembersPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  if (!listIdSchema.safeParse(listId).success) notFound()
  const session = await requireSession(`/lists/${listId}/members`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()

  const isOwner = list.members.some(
    (member) => member.userId === session.user.id && member.role === 'owner',
  )
  if (!isOwner) {
    return (
      <ContentContainer>
        <PageHeader
          eyebrow="Members"
          title={`${list.name} members`}
          description="Members and roles will be available here as list collaboration grows."
        />
        <Card className="max-w-2xl">
          <CardContent className="p-6 text-sm">
            Only list owners can inspect or manage invitations.
          </CardContent>
        </Card>
      </ContentContainer>
    )
  }

  const db = await getConnectedDatabase()
  const invitationDocuments = await invitations(
    db.collection<InvitationDocument>('list_invitations'),
  )
    .find({ listId })
    .sort({ createdAt: -1 })
    .toArray()

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Members"
        title={`${list.name} members`}
        description="Manage active members and pending invitations for this list."
      />
      <MemberManagement
        listId={listId}
        listName={list.name}
        initialMembers={list.members}
      />
      <InvitationManagement
        listId={listId}
        listName={list.name}
        initialInvitations={invitationDocuments.map((document) =>
          toInvitationSummary(document),
        )}
      />
    </ContentContainer>
  )
}
