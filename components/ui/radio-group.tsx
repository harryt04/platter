'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type RadioContextValue = {
  name: string
  value?: string
  onValueChange?: (value: string) => void
}
const RadioContext = React.createContext<RadioContextValue>({ name: '' })
export function RadioGroup({
  value,
  defaultValue,
  name,
  onValueChange,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value?: string
  defaultValue?: string
  name?: string
  onValueChange?: (value: string) => void
}) {
  const [internal, setInternal] = React.useState(defaultValue)
  const generatedName = React.useId()
  return (
    <RadioContext.Provider
      value={{
        name: name ?? `radio-group-${generatedName}`,
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
  onChange,
  onKeyDown,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const context = React.useContext(RadioContext)
  return (
    <input
      type="radio"
      id={id}
      name={context.name}
      value={value}
      checked={context.value === String(value)}
      onChange={(event) => {
        context.onValueChange?.(String(value ?? ''))
        onChange?.(event)
      }}
      onKeyDown={(event) => {
        if (
          event.key === 'ArrowDown' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowLeft'
        ) {
          const radios = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
          ).filter((radio) => radio.name === context.name)
          const currentTarget = event.currentTarget as HTMLInputElement
          const currentIndex = radios.findIndex(
            (radio) =>
              radio === currentTarget ||
              (radio.id.length > 0 && radio.id === currentTarget.id),
          )
          const direction =
            event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
          const next =
            radios[(currentIndex + direction + radios.length) % radios.length]

          if (next) {
            event.preventDefault()
            next.focus()
            context.onValueChange?.(next.value)
          }
        }
        onKeyDown?.(event)
      }}
      className="accent-primary h-4 w-4"
      {...props}
    />
  )
}
