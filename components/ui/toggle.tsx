'use client'

import { Toggle as TogglePart } from '@ui-sdk/react/toggle'
import type { ComponentProps } from 'react'
import { buttonClasses, type ButtonStyleProps } from '@/components/ui/button'

type ToggleProps = Omit<ComponentProps<typeof TogglePart>, 'className'> &
  ButtonStyleProps & { className?: string }

export function Toggle({ className, variant, size, ...props }: ToggleProps) {
  return (
    <TogglePart
      {...props}
      className={buttonClasses({ className, variant, size })}
    />
  )
}
