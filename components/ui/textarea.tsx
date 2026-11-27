'use client'

import { Textarea as TextareaPart } from '@ui-sdk/react/textarea'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Textarea({
  className,
  onValueChange,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> & {
  onValueChange?: (value: string) => void
}) {
  const classes = cn(
    'bg-background focus:ring-ring min-h-24 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none focus:ring-2',
    className,
  )
  const { value, defaultValue, ...rest } = props
  return (
    <TextareaPart
      className={classes}
      data-agent-secret
      {...rest}
      value={value == null ? undefined : String(value)}
      defaultValue={defaultValue == null ? undefined : String(defaultValue)}
      onValueChange={onValueChange}
    />
  )
}
