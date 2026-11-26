'use client'
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const subscribeToNothing = () => () => {}

export function AppearanceForm() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  // The stored theme is only known in the browser; reading it before
  // hydration finishes would render different text on the server.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
  return (
    <div className="space-y-4">
      <RadioGroup
        name="theme"
        value={hydrated ? (theme ?? null) : null}
        onValueChange={setTheme}
        aria-label="Theme preference"
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem id="theme-system" value="system" />
          <span>
            <span className="text-sm font-medium">System</span>
            <span className="text-muted-foreground mt-1 block text-sm">
              Follow your device. Currently resolved to{' '}
              {hydrated ? (resolvedTheme ?? 'system') : 'system'}.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem id="theme-light" value="light" />
          <span>
            <span className="text-sm font-medium">Light</span>
            <span className="text-muted-foreground mt-1 block text-sm">
              Use the bright Platter canvas.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem id="theme-dark" value="dark" />
          <span>
            <span className="text-sm font-medium">Dark</span>
            <span className="text-muted-foreground mt-1 block text-sm">
              Use blue-charcoal surfaces.
            </span>
          </span>
        </label>
      </RadioGroup>
    </div>
  )
}
