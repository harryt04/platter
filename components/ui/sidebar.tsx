'use client'

import * as React from 'react'
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
} from './dialog'

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
}
const SidebarContext = React.createContext<SidebarContextValue | null>(null)
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true)
  const [isMobile, setIsMobile] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
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
    <SidebarContext.Provider value={{ open, setOpen, isMobile, triggerRef }}>
      <div
        data-agent-hidden
        data-agent-secret
        className="flex min-h-screen w-full"
      >
        {children}
      </div>
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
  const { open, isMobile, setOpen, triggerRef } = useSidebar()
  const navigation = (
    <aside
      id="primary-navigation"
      aria-label="Primary navigation"
      className={cn(
        'flex shrink-0 flex-col border-r bg-[var(--sidebar)]',
        isMobile
          ? 'h-full w-full'
          : cn(
              'sticky top-0 z-30 h-screen transition-[width] duration-200',
              open ? 'w-64' : 'w-16',
            ),
        className,
      )}
    >
      {children}
      {isMobile && (
        <DialogClose
          render={<Button type="button" variant="ghost" size="icon" />}
          aria-label="Close navigation"
          className="absolute top-2 right-2"
        >
          <X size={18} />
        </DialogClose>
      )}
    </aside>
  )

  if (!isMobile) return navigation

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      container={typeof document === 'undefined' ? null : document.body}
    >
      <DialogBackdrop className="bg-foreground/20 fixed inset-0" />
      <DialogContent
        className="inset-y-0 right-auto left-0 m-0 h-dvh w-72 max-w-full rounded-none border-0 p-0"
        finalFocus={() => triggerRef.current}
      >
        <DialogTitle className="sr-only">Primary navigation</DialogTitle>
        {navigation}
      </DialogContent>
    </Dialog>
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

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn('justify-start', className)}
    >
      {children}
    </Button>
  )
}
export function SidebarTrigger() {
  const { open, setOpen, isMobile, triggerRef } = useSidebar()
  return (
    <Button
      ref={triggerRef}
      type="button"
      aria-label={open ? 'Close navigation' : 'Open navigation'}
      aria-controls="primary-navigation"
      aria-expanded={open}
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
