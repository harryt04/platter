'use client'

import type * as React from 'react'
import * as AlertDialogParts from '@ui-sdk/react/alert-dialog'
import { Button as ButtonPart } from '@ui-sdk/react/button'
import { cn } from '@/lib/utils'

export const AlertDialog = AlertDialogParts.AlertDialog

export function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogParts.AlertDialogContent>) {
  const container = typeof document === 'undefined' ? null : document.body

  return (
    <>
      <AlertDialogParts.AlertDialogBackdrop
        className="bg-background/80 fixed inset-0 z-50"
        data-platter="alert-dialog-backdrop"
      />
      <AlertDialogParts.AlertDialogContent
        container={container}
        className={cn(
          'bg-card fixed inset-0 z-50 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-[var(--radius-card)] border p-6 shadow-xl',
          className,
        )}
        {...props}
        data-agent-hidden
        data-agent-secret
      />
    </>
  )
}

export const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-2', className)} {...props} />
)
export const AlertDialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogParts.AlertDialogTitle>) => (
  <AlertDialogParts.AlertDialogTitle
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
)
export const AlertDialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogParts.AlertDialogDescription>) => (
  <AlertDialogParts.AlertDialogDescription
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
)
export const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
)
export function AlertDialogAction({
  className,
  type = 'button',
  ...props
}: React.ComponentProps<typeof ButtonPart>) {
  return (
    <ButtonPart
      className={cn(
        'bg-primary text-primary-foreground min-h-11 rounded-[var(--radius-button)] px-4 py-2 text-sm font-medium',
        className,
      )}
      type={type}
      {...props}
    />
  )
}

export function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogParts.AlertDialogClose>) {
  return (
    <AlertDialogParts.AlertDialogClose
      className={cn(
        'min-h-11 rounded-[var(--radius-button)] border px-4 py-2 text-sm font-medium',
        className,
      )}
      {...props}
    />
  )
}
