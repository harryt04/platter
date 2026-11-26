'use client'

import * as SelectParts from '@ui-sdk/react/select'
import { cn } from '@/lib/utils'

export const Select = SelectParts.Select
export function SelectTrigger({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SelectParts.SelectTrigger>, 'className'> & {
  className?: string
}) {
  return (
    <SelectParts.SelectTrigger
      className={cn(
        'flex min-h-11 w-full items-center justify-between rounded-[var(--radius-control)] border px-3 text-sm',
        className,
      )}
      {...props}
    />
  )
}
export function SelectContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SelectParts.SelectContent>, 'className'> & {
  className?: string
}) {
  return (
    <SelectParts.SelectContent
      container={typeof document === 'undefined' ? null : document.body}
      className={cn('bg-popover rounded-md border p-1', className)}
      {...props}
    />
  )
}
export function SelectItem({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SelectParts.SelectItem>, 'className'> & {
  className?: string
}) {
  return (
    <SelectParts.SelectItem
      className={cn(
        'data-highlighted:bg-muted min-h-11 px-3 py-2 text-sm',
        className,
      )}
      {...props}
    />
  )
}
export const SelectValue = SelectParts.SelectValue
