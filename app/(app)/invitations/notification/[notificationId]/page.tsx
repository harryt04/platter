import { InvitationAcceptance } from '@/components/lists/invitation-acceptance'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import {
  findInvitationForNotification,
  notificationIdSchema,
} from '@/lib/notifications'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { invitationIsExpired } from '@/lib/invitations'
import { notFound } from 'next/navigation'

export default async function NotificationInvitationPage({
  params,
}: {
  params: Promise<{ notificationId: string }>
}) {
  const { notificationId } = await params
  if (!notificationIdSchema.safeParse(notificationId).success) notFound()

  const session = await requireSession(
    `/invitations/notification/${notificationId}`,
  )
  const record = await findInvitationForNotification(
    await getConnectedDatabase(),
    notificationId,
    session.user.id,
  )
  if (!record) notFound()
  if (session.user.email.trim().toLowerCase() !== record.invitation.email) {
    notFound()
  }

  const unavailable =
    record.invitation.status !== 'pending'
      ? ('used-or-revoked' as const)
      : invitationIsExpired(record.invitation)
        ? ('expired' as const)
        : undefined
  const invitationPath = `/invitations/notification/${notificationId}`
  const acceptPath = `/api/v1/invitations/notifications/${notificationId}`

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="List invitation"
        title={`Join ${record.list.name}`}
        description="A list owner invited you to collaborate on this shared shopping run."
      />
      <InvitationAcceptance
        token={notificationId}
        acceptPath={acceptPath}
        invitationPath={invitationPath}
        listName={record.list.name}
        email={record.invitation.email}
        isAuthenticated
        unavailable={unavailable}
      />
    </ContentContainer>
  )
}
