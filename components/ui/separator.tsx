'use client'

import { Separator as SeparatorPart } from '@ui-sdk/react/separator'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
}) {
  return (
    <SeparatorPart
      orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}
