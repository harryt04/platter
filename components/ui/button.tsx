import * as React from 'react'
import { cn } from '@/lib/utils'

export function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'icon'
  asChild?: boolean
}) {
  const classes = cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-button)] px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
    variant === 'default' &&
      'bg-primary text-primary-foreground hover:opacity-90',
    variant === 'outline' && 'border bg-transparent hover:bg-muted',
    variant === 'ghost' && 'hover:bg-muted',
    variant === 'secondary' &&
      'bg-secondary text-secondary-foreground hover:brightness-95',
    variant === 'destructive' &&
      'bg-destructive text-destructive-foreground hover:opacity-90',
    size === 'sm' && 'min-h-9 px-3',
    size === 'icon' && 'w-11 px-0',
    className,
  )
  if (asChild && React.isValidElement<{ className?: string }>(children))
    return React.cloneElement(children, {
      className: cn(classes, children.props.className),
    })
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
