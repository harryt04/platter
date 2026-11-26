'use client'

import * as TabParts from '@ui-sdk/react/tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabParts.Tabs
export function TabsList({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabParts.TabsList>, 'className'> & {
  className?: string
}) {
  return (
    <TabParts.TabsList
      className={cn('inline-flex rounded-md border p-1', className)}
      {...props}
    />
  )
}
export function TabsTrigger({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabParts.TabsTab>, 'className'> & {
  className?: string
}) {
  return (
    <TabParts.TabsTab
      className={cn('min-h-10 rounded px-3 text-sm', className)}
      {...props}
    />
  )
}
export function TabsContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabParts.TabsPanel>, 'className'> & {
  className?: string
}) {
  return <TabParts.TabsPanel className={cn('mt-4', className)} {...props} />
}
