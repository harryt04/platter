'use client'

import {
  Checkbox as CheckboxPart,
  CheckboxIndicator,
} from '@ui-sdk/react/checkbox'
import { Check, Minus } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type CheckboxProps = Omit<
  ComponentProps<typeof CheckboxPart>,
  'className' | 'onCheckedChange'
> & {
  className?: string
  onCheckedChange?: (checked: boolean) => void
}

export function Checkbox({
  className,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPart
      {...props}
      className={cn(
        'group border-muted-foreground focus-visible:outline-ring data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground relative inline-flex h-5 !min-h-0 w-5 shrink-0 items-center justify-center rounded border after:absolute after:-inset-3 focus-visible:outline-2 data-disabled:opacity-50',
        className,
      )}
      onCheckedChange={(checked) => onCheckedChange?.(checked === true)}
    >
      <CheckboxIndicator>
        <Check
          aria-hidden="true"
          className="size-4 group-data-indeterminate:hidden"
        />
        <Minus
          aria-hidden="true"
          className="hidden size-4 group-data-indeterminate:block"
        />
      </CheckboxIndicator>
    </CheckboxPart>
  )
}
