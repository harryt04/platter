import Link from 'next/link'
import { PlaceholderPage } from '@/components/states/placeholder-page'
import { Button } from '@/components/ui/button'
export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Manage your appearance and account details."
      action="Appearance"
      actionHref="/settings/appearance"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" asChild>
          <Link href="/settings/appearance">Appearance</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/settings/account">Account</Link>
        </Button>
      </div>
    </PlaceholderPage>
  )
}
