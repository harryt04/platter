'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getAttribute('tabindex') !== '-1',
  )
}

export const AlertDialog = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const focusables = getFocusableElements(dialog)
    if (!dialog.contains(document.activeElement)) {
      const initialFocus = focusables[0] ?? dialog
      initialFocus.focus()
    }

    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    props.onKeyDown?.(event)
    if (event.defaultPrevented || event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return
    const focusables = getFocusableElements(dialog)
    if (focusables.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      {...props}
      ref={dialogRef}
      role="alertdialog"
      aria-modal={props['aria-modal'] ?? true}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}
export const AlertDialogContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'bg-card rounded-[var(--radius-card)] border p-6 shadow-xl',
      className,
    )}
    {...props}
  />
)
export const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-2', className)} {...props} />
)
export const AlertDialogTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('text-lg font-semibold', className)} {...props} />
)
export const AlertDialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-muted-foreground text-sm', className)} {...props} />
)
export const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
)
export const AlertDialogAction = (
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) => (
  <button
    className="bg-primary text-primary-foreground min-h-11 rounded-[var(--radius-button)] px-4 py-2 text-sm font-medium"
    {...props}
  />
)
export const AlertDialogCancel = (
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) => (
  <button
    className="min-h-11 rounded-[var(--radius-button)] border px-4 py-2 text-sm font-medium"
    {...props}
  />
)
