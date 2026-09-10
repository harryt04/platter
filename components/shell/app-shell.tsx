import { AppSidebar } from './app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { OfflineBanner } from '@/components/states/offline-banner'
import { NotificationBell } from '@/components/notifications/notification-bell'

export function AppShell({
  children,
  lists,
}: {
  children: React.ReactNode
  lists?: { id: string; name: string }[]
}) {
  return (
    <SidebarProvider>
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
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
