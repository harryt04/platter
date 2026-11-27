'use client'

import { isValidElement } from 'react'
import * as DialogParts from '@ui-sdk/react/dialog'
import { cn } from '@/lib/utils'

export const Sheet = DialogParts.Dialog
export function SheetTrigger({ children }: { children: React.ReactNode }) {
  if (isValidElement(children))
    return <DialogParts.DialogTrigger render={children} />
  return <DialogParts.DialogTrigger>{children}</DialogParts.DialogTrigger>
}
export function SheetContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof DialogParts.DialogContent>, 'className'> & {
  className?: string
}) {
  return (
    <DialogParts.DialogContent
      container={typeof document === 'undefined' ? null : document.body}
      className={cn(
        'bg-card fixed inset-y-0 right-0 left-auto z-50 m-0 h-dvh max-h-dvh w-full max-w-sm border-l p-6 shadow-xl',
        className,
      )}
      {...props}
      data-agent-hidden
      data-agent-secret
    />
  )
}
