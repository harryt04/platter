'use client'

import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { isoDateTime } from '@/lib/contracts/ids'
import type { NotificationSummary } from '@/lib/notifications'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void fetch('/api/v1/notifications')
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as {
          notifications: NotificationSummary[]
        }
      })
      .then((result) => {
        if (result) setNotifications(result.notifications)
      })
      .catch(() => undefined)
  }, [])

  const unreadCount = notifications.filter(
    (notification) => !notification.readAt,
  ).length

  async function markRead(id: string) {
    const response = await fetch(`/api/v1/notifications/${id}`, {
      method: 'PATCH',
    })
    if (!response.ok) return
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              readAt: isoDateTime(new Date()),
            }
          : notification,
      ),
    )
  }

  return (
    <div className="relative ml-auto">
      <Button
        aria-expanded={open}
        aria-label={
          unreadCount ? `${unreadCount} unread notifications` : 'Notifications'
        }
        size="icon"
        variant="ghost"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="bg-secondary text-secondary-foreground absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <Card className="absolute top-12 right-0 z-30 w-[min(20rem,calc(100vw-2rem))]">
          <CardContent className="max-h-[min(28rem,70vh)] overflow-y-auto p-2">
            <p className="px-3 py-2 text-sm font-semibold">Notifications</p>
            {notifications.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-sm">
                You’re all caught up.
              </p>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <button
                    className="hover:bg-muted w-full rounded-md px-3 py-3 text-left"
                    key={notification.id}
                    onClick={() => void markRead(notification.id)}
                  >
                    <span className="block text-sm font-medium">
                      {notification.title}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {notification.body}
                    </span>
                    {!notification.readAt && (
                      <span className="text-primary mt-2 block text-xs font-medium">
                        Unread
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
