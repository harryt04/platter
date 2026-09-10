import { requireSession } from '@/lib/auth/authorization'
import { AppShell } from '@/components/shell/app-shell'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()
  const db = await getConnectedDatabase()
  const lists = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(session.user.id), {
      projection: { _id: 1, name: 1 },
    })
    .sort({ name: 1 })
    .toArray()

  return (
    <AppShell lists={lists.map(({ _id, name }) => ({ id: _id, name }))}>
      {children}
    </AppShell>
  )
}
