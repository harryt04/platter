'use client'

import Link from 'next/link'
import {
  ChefHat,
  Compass,
  ListChecks,
  Plus,
  Settings,
  Utensils,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/auth-client'
import { clearOfflineSession } from '@/lib/offline/database'
import { PlatterMark } from '@/components/brand/platter-mark'

const groups = [
  {
    label: 'Cook this week',
    items: [
      { href: '/lists', label: 'Shopping run', icon: ListChecks },
      { href: '/discover', label: 'Discover', icon: Compass },
      { href: '/my-recipes', label: 'My recipes', icon: Utensils },
    ],
  },
]

export function AppSidebar({
  lists,
}: {
  lists: { id: string; name: string }[]
}) {
  const pathname = usePathname()
  const { open, isMobile, setOpen } = useSidebar()
  const closeMobileNavigation = () => {
    if (isMobile) setOpen(false)
  }
  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/lists"
          aria-label="Platter home"
          className="font-display flex min-h-11 items-center gap-3 text-xl font-semibold"
          onClick={closeMobileNavigation}
        >
          <PlatterMark aria-hidden="true" className="h-9 w-9 rounded-md" />
          <span className="sidebar-label">Platter</span>
        </Link>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    active={
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                    }
                    asChild
                  >
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      onClick={closeMobileNavigation}
                    >
                      <item.icon size={18} />
                      <span className="sidebar-label">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        <SidebarGroup>
          <SidebarGroupLabel>Your lists</SidebarGroupLabel>
          <SidebarMenu>
            {lists.map((list) => (
              <SidebarMenuItem key={list.id}>
                <SidebarMenuButton
                  active={pathname.startsWith(`/lists/${list.id}`)}
                  asChild
                >
                  <Link
                    href={`/lists/${list.id}`}
                    aria-label={list.name}
                    onClick={closeMobileNavigation}
                  >
                    <ChefHat size={18} />
                    <span className="sidebar-label">{list.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/lists/new"
                  aria-label="New list"
                  onClick={closeMobileNavigation}
                >
                  <Plus size={18} />
                  <span className="sidebar-label">New list</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2">
          {open && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Your account</p>
              <p className="text-muted-foreground truncate text-xs">
                Local foundation user
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            asChild
          >
            <Link href="/settings" onClick={closeMobileNavigation}>
              <Settings size={18} />
            </Link>
          </Button>
        </div>
        <button
          aria-label="Sign out"
          className="text-muted-foreground hover:text-foreground mt-2 min-h-11 w-full text-left text-xs"
          onClick={async () => {
            await clearOfflineSession().catch(() => undefined)
            await authClient.signOut()
          }}
        >
          {open ? 'Sign out' : '↪'}
        </button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
