'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
export const AlertDialog = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="alertdialog" {...props}>
    {children}
  </div>
)
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
