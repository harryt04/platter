'use client'

import { isValidElement } from 'react'
import * as TooltipParts from '@ui-sdk/react/tooltip'
import { cn } from '@/lib/utils'

export const Tooltip = TooltipParts.Tooltip
export function TooltipTrigger({ children }: { children: React.ReactNode }) {
  if (isValidElement(children))
    return <TooltipParts.TooltipTrigger render={children} />
  return <TooltipParts.TooltipTrigger>{children}</TooltipParts.TooltipTrigger>
}
export function TooltipContent({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof TooltipParts.TooltipContent>,
  'className'
> & { className?: string }) {
  return (
    <TooltipParts.TooltipContent
      container={typeof document === 'undefined' ? null : document.body}
      className={cn(
        'bg-foreground text-background rounded px-2 py-1 text-xs',
        className,
      )}
      {...props}
    />
  )
}
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
