import * as React from 'react'
import { cn } from '@/lib/utils'

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        variant === 'default' &&
          'bg-primary text-primary-foreground border-transparent',
        variant === 'secondary' &&
          'bg-secondary text-secondary-foreground border-transparent',
        variant === 'success' &&
          'bg-success text-success-foreground border-transparent',
        variant === 'warning' &&
          'bg-warning text-warning-foreground border-transparent',
        className,
      )}
      {...props}
    />
  )
}
