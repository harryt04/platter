'use client'

import * as React from 'react'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
}
const SidebarContext = React.createContext<SidebarContextValue | null>(null)
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true)
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => {
      const mobile = query.matches
      setIsMobile(mobile)
      if (mobile) setOpen(false)
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return (
    <SidebarContext.Provider value={{ open, setOpen, isMobile }}>
      <div className="flex min-h-screen w-full">{children}</div>
    </SidebarContext.Provider>
  )
}
export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context)
    throw new Error('useSidebar must be used within SidebarProvider')
  return context
}
export function Sidebar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { open, isMobile, setOpen } = useSidebar()
  return (
    <>
      <aside
        className={cn(
          'sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r bg-[var(--sidebar)] transition-[width,transform] duration-200',
          isMobile
            ? open
              ? 'fixed inset-y-0 left-0 w-72 shadow-xl'
              : 'fixed w-72 -translate-x-full'
            : open
              ? 'w-64'
              : 'w-16',
          className,
        )}
        aria-label="Primary navigation"
      >
        {children}
      </aside>
      {isMobile && open && (
        <button
          aria-label="Close navigation"
          className="bg-foreground/20 fixed inset-0 z-20"
          onClick={() => setOpen(false)}
          type="button"
        />
      )}
    </>
  )
}
export function SidebarHeader({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useSidebar()
  return (
    <div
      className={cn(
        'flex min-h-16 items-center px-3',
        !open && 'justify-center px-0 [&_.sidebar-label]:hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}
export function SidebarContent({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-3 py-4', className)}>
      {children}
    </div>
  )
}
export function SidebarFooter({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t p-3', className)}>{children}</div>
}
export function SidebarRail() {
  return null
}
export function SidebarInset({
  children,
  className,
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <main className={cn('flex min-w-0 flex-1 flex-col', className)}>
      {children}
    </main>
  )
}
export function SidebarGroup({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('mb-6', className)}>{children}</section>
}
export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar()
  return open ? (
    <p className="font-data text-muted-foreground mb-2 px-3 text-xs tracking-wider uppercase">
      {children}
    </p>
  ) : null
}
export function SidebarMenu({ children }: { children: React.ReactNode }) {
  return <nav className="grid gap-1">{children}</nav>
}
export function SidebarMenuItem({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
export function SidebarMenuButton({
  children,
  active,
  asChild = false,
}: {
  children: React.ReactNode
  active?: boolean
  asChild?: boolean
}) {
  const { open } = useSidebar()
  const className = cn(
    'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-[var(--sidebar-accent)]',
    active &&
      'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]',
    !open && 'justify-center px-0 [&_.sidebar-label]:hidden',
  )

  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      className: cn(className, children.props.className),
    })
  }

  return <button className={className}>{children}</button>
}
export function SidebarTrigger() {
  const { open, setOpen, isMobile } = useSidebar()
  return (
    <Button
      aria-label={open ? 'Close navigation' : 'Open navigation'}
      variant="ghost"
      size="icon"
      onClick={() => setOpen(!open)}
    >
      {isMobile ? (
        <Menu size={18} />
      ) : open ? (
        <PanelLeftClose size={18} />
      ) : (
        <PanelLeftOpen size={18} />
      )}
    </Button>
  )
}
