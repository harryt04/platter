import * as React from 'react'
import { cn } from '@/lib/utils'

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'bg-background focus:ring-ring min-h-24 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}
