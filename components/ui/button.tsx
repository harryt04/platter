import * as React from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'icon'
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      children,
      ...props
    },
    ref,
  ) {
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
      // Compact buttons may use less horizontal space, but every action remains
      // touch-safe per the product's 44px interaction-target contract.
      size === 'sm' && 'min-h-11 px-3',
      size === 'icon' && 'w-11 px-0',
      className,
    )
    if (asChild && React.isValidElement<Record<string, unknown>>(children))
      return React.cloneElement(children, {
        ...props,
        className: cn(
          classes,
          typeof children.props.className === 'string'
            ? children.props.className
            : undefined,
        ),
      })
    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    )
  },
)
