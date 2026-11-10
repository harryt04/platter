import { SuppressionManagement } from '@/components/admin/suppression-management'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireAdmin } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  findPublicContentSuppressions,
  toPublicContentSuppressionSummary,
} from '@/lib/public-content-suppressions'

export default async function AdminSuppressionsPage() {
  await requireAdmin()
  const suppressions = await findPublicContentSuppressions(
    await getConnectedDatabase(),
  )

  return (
    <ContentContainer>
      <PageHeader
        description="Restore public content only through an explicit, audited action. Private list access and shopping authority are not part of moderation."
        eyebrow="Administration"
        title="Suppressions"
      />
      <SuppressionManagement
        initialSuppressions={suppressions.map(
          toPublicContentSuppressionSummary,
        )}
      />
    </ContentContainer>
  )
}
