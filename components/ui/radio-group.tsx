'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type RadioContextValue = {
  value?: string
  onValueChange?: (value: string) => void
}
const RadioContext = React.createContext<RadioContextValue>({})
export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}) {
  const [internal, setInternal] = React.useState(defaultValue)
  return (
    <RadioContext.Provider
      value={{
        value: value ?? internal,
        onValueChange: (next) => {
          setInternal(next)
          onValueChange?.(next)
        },
      }}
    >
      <div role="radiogroup" className={cn('grid gap-2', className)} {...props}>
        {children}
      </div>
    </RadioContext.Provider>
  )
}
export function RadioGroupItem({
  value,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const context = React.useContext(RadioContext)
  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={context.value === String(value)}
      onChange={() => context.onValueChange?.(String(value ?? ''))}
      className="accent-primary h-4 w-4"
      {...props}
    />
  )
}
