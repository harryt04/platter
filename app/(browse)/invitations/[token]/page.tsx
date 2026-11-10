import { InvitationAcceptance } from '@/components/lists/invitation-acceptance'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { getSession } from '@/lib/auth/authorization'
import {
  findInvitationByToken,
  invitationIsExpired,
  invitationTokenSchema,
} from '@/lib/invitations'
import { notFound } from 'next/navigation'

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!invitationTokenSchema.safeParse(token).success) notFound()

  const record = await findInvitationByToken(token)
  if (!record) notFound()

  const session = await getSession()
  const unavailable =
    record.invitation.status !== 'pending'
      ? ('used-or-revoked' as const)
      : invitationIsExpired(record.invitation)
        ? ('expired' as const)
        : undefined
  const invitationPath = `/invitations/${token}`

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="List invitation"
        title={`Join ${record.list.name}`}
        description="A list owner invited you to collaborate on this shared shopping run."
      />
      <InvitationAcceptance
        token={token}
        invitationPath={invitationPath}
        listName={record.list.name}
        email={record.invitation.email}
        isAuthenticated={Boolean(session)}
        unavailable={unavailable}
      />
    </ContentContainer>
  )
}
