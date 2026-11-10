import { requireAdmin } from '@/lib/auth/authorization'
import { InstanceStatusSummary } from '@/components/settings/instance-status-summary'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { getInstancePolicySummary } from '@/lib/instance-policy'

export default async function InstancePage() {
  await requireAdmin()

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Administrator settings"
        title="Instance settings"
        description="Review the services and policy gates that shape this hosted Platter instance. Secret values are never shown here."
      />
      <InstanceStatusSummary summary={getInstancePolicySummary()} />
    </ContentContainer>
  )
}
