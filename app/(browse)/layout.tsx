import { getSession } from '@/lib/auth/authorization'
import { AppShell } from '@/components/shell/app-shell'
import { PublicHeader } from '@/components/shell/public-header'

export default async function BrowseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  return session ? (
    <AppShell>{children}</AppShell>
  ) : (
    <>
      <PublicHeader />
      {children}
    </>
  )
}
