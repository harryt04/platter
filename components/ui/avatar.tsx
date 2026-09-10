import * as React from 'react'
import { cn } from '@/lib/utils'
export function Avatar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-muted flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-medium',
        className,
      )}
      {...props}
    />
  )
}
export function AvatarFallback({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
