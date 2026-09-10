import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'bg-background placeholder:text-muted-foreground focus:ring-ring min-h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm outline-none focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}
