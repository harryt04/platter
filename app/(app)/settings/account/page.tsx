import { AccountProfileForm } from '@/components/settings/account-profile-form'
import { requireSession } from '@/lib/auth/authorization'
import { defaultProfileLocale, profileLocaleOptions } from '@/lib/account'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { AccountExportPanel } from '@/components/settings/account-export-panel'
import { AccountDeletionImpactPanel } from '@/components/settings/account-deletion-impact-panel'
import { AccountDeletionPanel } from '@/components/settings/account-deletion-panel'

export default async function AccountPage() {
  const session = await requireSession('/settings/account')
  const initialLocale =
    profileLocaleOptions.find(({ value }) => value === session.user.locale)
      ?.value ?? defaultProfileLocale

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Settings"
        title="Account"
        description="Keep your name and locale up to date. Your email address is managed by sign-in."
      />
      <AccountProfileForm
        email={session.user.email}
        initialLocale={initialLocale}
        initialName={session.user.name}
      />
      <AccountExportPanel locale={initialLocale} />
      <AccountDeletionImpactPanel />
      <AccountDeletionPanel
        email={session.user.email}
        userId={session.user.id}
      />
    </ContentContainer>
  )
}
