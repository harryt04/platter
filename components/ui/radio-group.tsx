'use client'

import {
  Radio,
  RadioGroup as RadioGroupPart,
  RadioIndicator,
} from '@ui-sdk/react/radio'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type RadioGroupProps = Omit<
  ComponentProps<typeof RadioGroupPart>,
  'className' | 'value' | 'defaultValue' | 'onValueChange'
> & {
  className?: string
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
}

export function RadioGroup({
  className,
  onValueChange,
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPart
      loop
      {...props}
      className={cn('grid gap-2', className)}
      onValueChange={(value) => {
        if (typeof value === 'string') onValueChange?.(value)
      }}
    />
  )
}

export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof Radio> & { className?: string }) {
  return (
    <Radio
      {...props}
      className={cn(
        // The global 44px control height would stretch the circle; the
        // pseudo-element keeps a 44px touch target instead.
        'border-muted-foreground focus-visible:outline-ring data-checked:border-primary relative inline-flex size-4 !min-h-0 shrink-0 items-center justify-center rounded-full border after:absolute after:-inset-3.5 focus-visible:outline-2',
        className,
      )}
    >
      <RadioIndicator className="bg-primary size-2 rounded-full" />
    </Radio>
  )
}
