import { AppSidebar } from './app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { OfflineBanner } from '@/components/states/offline-banner'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-8">
          <SidebarTrigger />
          <div className="font-data text-muted-foreground text-xs tracking-widest uppercase">
            Prepared utility
          </div>
        </header>
        <OfflineBanner />
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
