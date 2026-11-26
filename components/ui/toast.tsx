'use client'

import { X } from 'lucide-react'
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
  toast,
} from '@ui-sdk/react/toast'

export { toast }

export function Toaster() {
  return (
    <ToastRegion
      side="bottom"
      align="center"
      data-agent-hidden
      data-platter-toast-region=""
      className="fixed bottom-4 left-1/2 z-[60] w-[min(356px,calc(100vw-2rem))] -translate-x-1/2"
    >
      {() => (
        <Toast
          data-platter-toast=""
          className="bg-card text-card-foreground data-[type=error]:border-destructive data-[type=success]:border-success data-[type=warning]:border-warning flex items-start gap-3 rounded-[var(--radius-card)] border p-4 shadow-lg"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <ToastTitle className="text-sm font-semibold" />
            <ToastDescription className="text-muted-foreground text-sm empty:hidden" />
          </div>
          <ToastAction className="bg-primary text-primary-foreground min-h-11 shrink-0 rounded-[var(--radius-button)] px-3 text-sm font-medium empty:hidden" />
          <ToastClose
            aria-label="Dismiss notification"
            className="text-muted-foreground hover:text-foreground flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)]"
          >
            <X size={16} aria-hidden="true" />
          </ToastClose>
        </Toast>
      )}
    </ToastRegion>
  )
}
