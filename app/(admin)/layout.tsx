import { requireAdmin } from '@/lib/auth/authorization'
import { AppShell } from '@/components/shell/app-shell'
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()
  return <AppShell userId={session.user.id}>{children}</AppShell>
}
