'use client'

import { isValidElement } from 'react'
import * as DialogParts from '@ui-sdk/react/dialog'
import { cn } from '@/lib/utils'

export const Dialog = DialogParts.Dialog
export function DialogTrigger({ children }: { children: React.ReactNode }) {
  if (isValidElement(children))
    return <DialogParts.DialogTrigger render={children} />
  return <DialogParts.DialogTrigger>{children}</DialogParts.DialogTrigger>
}
export function DialogContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof DialogParts.DialogContent>, 'className'> & {
  className?: string
}) {
  return (
    <DialogParts.DialogContent
      container={typeof document === 'undefined' ? null : document.body}
      className={cn(
        'bg-card fixed inset-0 m-auto h-fit w-fit rounded-[var(--radius-card)] border p-6 shadow-xl',
        className,
      )}
      {...props}
    />
  )
}
export function DialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof DialogParts.DialogTitle>, 'className'> & {
  className?: string
}) {
  return (
    <DialogParts.DialogTitle
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  )
}
export function DialogDescription({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof DialogParts.DialogDescription>,
  'className'
> & { className?: string }) {
  return (
    <DialogParts.DialogDescription
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}
export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 space-y-2">{children}</div>
)
export const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-6 flex justify-end gap-2">{children}</div>
)
