import { ComplaintQueue } from '@/components/admin/complaint-queue'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireAdmin } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  recordComplaintAudit,
  toAdminComplaintSummary,
  type ComplaintDocument,
} from '@/lib/complaints'

export default async function AdminComplaintsPage() {
  const session = await requireAdmin()
  const db = await getConnectedDatabase()
  const complaints = await db
    .collection<ComplaintDocument>('complaints')
    .find({})
    .sort({ receivedAt: -1, _id: -1 })
    .limit(100)
    .toArray()
  await recordComplaintAudit(db, {
    action: 'queue-viewed',
    actorId: session.user.id,
    complaintIds: complaints.map((complaint) => complaint._id),
  })

  return (
    <ContentContainer>
      <PageHeader
        description="Review public-content reports and record the next action. Contact data is restricted to this administrator workflow."
        eyebrow="Administration"
        title="Complaints"
      />
      <ComplaintQueue
        initialComplaints={complaints.map(toAdminComplaintSummary)}
      />
    </ContentContainer>
  )
}
