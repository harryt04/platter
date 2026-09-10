import { requireAdmin } from '@/lib/auth/authorization'
import { AppShell } from '@/components/shell/app-shell'
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return <AppShell>{children}</AppShell>
}
