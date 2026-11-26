'use client'

import { isValidElement } from 'react'
import * as PopoverParts from '@ui-sdk/react/popover'
import { cn } from '@/lib/utils'

export const Popover = PopoverParts.Popover
export function PopoverTrigger({ children }: { children: React.ReactNode }) {
  if (isValidElement(children))
    return <PopoverParts.PopoverTrigger render={children} />
  return <PopoverParts.PopoverTrigger>{children}</PopoverParts.PopoverTrigger>
}
export function PopoverContent({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof PopoverParts.PopoverContent>,
  'className'
> & { className?: string }) {
  return (
    <PopoverParts.PopoverContent
      container={typeof document === 'undefined' ? null : document.body}
      className={cn('bg-popover rounded-md border p-4 shadow-lg', className)}
      {...props}
    />
  )
}
