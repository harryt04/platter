import { requireSession } from '@/lib/auth/authorization'
import { AppShell } from '@/components/shell/app-shell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()
  return <AppShell>{children}</AppShell>
}
