'use client'
import * as React from 'react'
export const Dialog = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const DialogTrigger = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const DialogContent = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    role="dialog"
    className={`bg-card rounded-[var(--radius-card)] border p-6 shadow-xl ${className}`}
  >
    {children}
  </div>
)
export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 space-y-2">{children}</div>
)
export const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold">{children}</h2>
)
export const DialogDescription = ({
  children,
}: {
  children: React.ReactNode
}) => <p className="text-muted-foreground text-sm">{children}</p>
export const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-6 flex justify-end gap-2">{children}</div>
)
