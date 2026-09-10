import { requireAdmin } from '@/lib/auth/authorization'
import { PlaceholderPage } from '@/components/states/placeholder-page'
export default async function InstancePage() {
  await requireAdmin()
  return (
    <PlaceholderPage
      title="Instance settings"
      description="Self-hosting, public-catalog, email, analytics, and moderation settings are restricted to administrators."
    />
  )
}
