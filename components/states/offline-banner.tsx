'use client'
import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return offline ? (
    <div
      aria-live="polite"
      className="border-warning bg-warning/15 text-warning-foreground border-b px-4 py-2 text-center text-sm"
      role="status"
    >
      Offline. Changes stay on this device until you reconnect.
    </div>
  ) : null
}
