'use client'

import { bindRepeat } from '@ui-sdk/core'
import * as SelectParts from '@ui-sdk/react/select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useRef, type ComponentProps, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Select = SelectParts.Select
export const SelectValue = SelectParts.SelectValue

export function SelectTrigger({
  children,
  className,
  ...props
}: Omit<
  ComponentProps<typeof SelectParts.SelectTrigger>,
  'className' | 'children'
> & {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <SelectParts.SelectTrigger
      className={cn(
        'bg-background focus:ring-ring flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 text-left text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </SelectParts.SelectTrigger>
  )
}

export function SelectContent({
  className,
  ...props
}: Omit<ComponentProps<typeof SelectParts.SelectContent>, 'className'> & {
  className?: string
}) {
  return (
    <SelectParts.SelectContent
      alignItemWithTrigger={false}
      sideOffset={4}
      className={cn(
        'bg-popover text-popover-foreground z-50 min-w-[var(--anchor-width)] rounded-md border p-1 shadow-md',
        className,
      )}
      {...props}
      container={typeof document === 'undefined' ? null : document.body}
      data-agent-hidden
      data-agent-secret
    />
  )
}

export function SelectItem({
  children,
  className,
  ...props
}: Omit<
  ComponentProps<typeof SelectParts.SelectItem<string>>,
  'className' | 'children'
> & {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <SelectParts.SelectItem
      className={cn(
        'data-highlighted:bg-muted flex min-h-11 cursor-default items-center justify-between gap-2 rounded px-3 py-2 text-sm data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectParts.SelectItemText>{children}</SelectParts.SelectItemText>
      <SelectParts.SelectItemIndicator>
        <Check aria-hidden="true" className="size-4" />
      </SelectParts.SelectItemIndicator>
    </SelectParts.SelectItem>
  )
}

function SelectScrollArrow({
  list,
  direction,
}: {
  list: RefObject<HTMLDivElement | null>
  direction: 'up' | 'down'
}) {
  const Icon = direction === 'up' ? ChevronUp : ChevronDown
  return (
    <Button
      variant="ghost"
      ref={(button) => {
        if (!button) return
        return bindRepeat(button, {
          onStep: () =>
            list.current?.scrollBy(0, direction === 'up' ? -44 : 44),
        })
      }}
      aria-hidden="true"
      className="hover:bg-muted flex h-11 w-full items-center justify-center"
      onMouseDown={(event) => event.preventDefault()}
      tabIndex={-1}
      type="button"
    >
      <Icon className="size-4" />
    </Button>
  )
}

type SelectFieldProps = {
  id: string
  items: readonly { value: string; label: string; disabled?: boolean }[]
  name?: string
  disabled?: boolean
  placeholder?: string
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  'aria-label'?: string
  triggerClassName?: string
}

export function SelectField({
  id,
  items,
  placeholder = 'Select an option',
  'aria-label': label,
  triggerClassName,
  ...props
}: SelectFieldProps) {
  const list = useRef<HTMLDivElement>(null)
  const showScrollArrows = items.length > 6

  return (
    <Select<string> {...props} items={[...items]}>
      <SelectTrigger id={id} aria-label={label} className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[var(--available-height)] overflow-auto">
        {showScrollArrows && <SelectScrollArrow list={list} direction="up" />}
        <SelectParts.SelectList
          ref={list}
          className={
            showScrollArrows
              ? 'max-h-[min(18rem,calc(var(--available-height)_-_6rem))] overflow-y-auto'
              : undefined
          }
        >
          {items.map((item) => (
            <SelectItem key={item.value} {...item}>
              {item.label}
            </SelectItem>
          ))}
        </SelectParts.SelectList>
        {showScrollArrows && <SelectScrollArrow list={list} direction="down" />}
      </SelectContent>
    </Select>
  )
}
