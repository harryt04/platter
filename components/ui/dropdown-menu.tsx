'use client'

import { isValidElement } from 'react'
import * as MenuParts from '@ui-sdk/react/menu'
import { cn } from '@/lib/utils'

export const DropdownMenu = MenuParts.Menu
export function DropdownMenuTrigger({
  children,
}: {
  children: React.ReactNode
}) {
  if (isValidElement(children))
    return <MenuParts.MenuTrigger render={children} />
  return <MenuParts.MenuTrigger>{children}</MenuParts.MenuTrigger>
}
export function DropdownMenuContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof MenuParts.MenuContent>, 'className'> & {
  className?: string
}) {
  return (
    <MenuParts.MenuContent
      container={typeof document === 'undefined' ? null : document.body}
      className={cn('bg-popover rounded-md border p-1 shadow-lg', className)}
      {...props}
    />
  )
}
export function DropdownMenuItem({
  className,
  ...props
}: Omit<React.ComponentProps<typeof MenuParts.MenuItem>, 'className'> & {
  className?: string
}) {
  return (
    <MenuParts.MenuItem
      className={cn(
        'hover:bg-muted data-highlighted:bg-muted flex min-h-11 items-center rounded px-3 text-sm',
        className,
      )}
      {...props}
    />
  )
}
