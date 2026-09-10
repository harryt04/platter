import { AppSidebar } from './app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { OfflineBanner } from '@/components/states/offline-banner'
import { OfflineMutationSync } from '@/components/states/offline-mutation-sync'
import { OfflineShellSnapshotWriter } from '@/components/states/offline-snapshot-writers'
import { NotificationBell } from '@/components/notifications/notification-bell'

export function AppShell({
  children,
  userId,
  lists,
}: {
  children: React.ReactNode
  userId: string
  lists?: { id: string; name: string; status: 'active' | 'archived' }[]
}) {
  return (
    <SidebarProvider>
      {lists && (
        <OfflineShellSnapshotWriter
          payload={{
            kind: 'shell',
            lists: lists.map((list) => ({
              id: list.id,
              name: list.name,
              status: list.status,
            })),
          }}
          updatedAt={new Date().toISOString()}
          userId={userId}
        />
      )}
      <AppSidebar lists={lists ?? []} />
      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-8">
          <SidebarTrigger />
          <div className="font-data text-muted-foreground text-xs tracking-widest uppercase">
            Prepared utility
          </div>
          <NotificationBell />
        </header>
        <OfflineBanner />
        <OfflineMutationSync userId={userId} />
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
