'use client'

import { Input as InputPart } from '@ui-sdk/react/input'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({
  className,
  onValueChange,
  agentReadable = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  agentReadable?: boolean
  onValueChange?: (value: string) => void
}) {
  const classes = cn(
    'bg-background placeholder:text-muted-foreground focus:ring-ring min-h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm outline-none focus:ring-2',
    className,
  )
  const { value, defaultValue, ...rest } = props
  return (
    <InputPart
      className={classes}
      data-agent-secret={agentReadable ? undefined : true}
      {...rest}
      value={value == null ? undefined : String(value)}
      defaultValue={defaultValue == null ? undefined : String(defaultValue)}
      onValueChange={onValueChange}
    />
  )
}
