'use client'

import { Label as LabelPart } from '@ui-sdk/react/label'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <LabelPart className={cn('text-sm font-medium', className)} {...props} />
  )
}
