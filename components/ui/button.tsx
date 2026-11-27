'use client'

import { Button as ButtonPart } from '@ui-sdk/react/button'
import * as React from 'react'
import { cn } from '@/lib/utils'

export type ButtonStyleProps = {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'icon'
}

export function buttonClasses({
  className,
  variant = 'default',
  size = 'default',
}: ButtonStyleProps & { className?: string }) {
  return cn(
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
}

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> &
  Pick<React.ComponentProps<typeof ButtonPart>, 'onClick'> &
  ButtonStyleProps & { asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, asChild, children, type = 'submit', ...props },
    ref,
  ) {
    const classes = buttonClasses({ className, variant, size })
    if (asChild) {
      const [child] = React.Children.toArray(children)
      if (React.isValidElement(child)) {
        return (
          <ButtonPart className={classes} ref={ref} render={child} {...props} />
        )
      }
    }

    return (
      <ButtonPart className={classes} ref={ref} type={type} {...props}>
        {children}
      </ButtonPart>
    )
  },
)
