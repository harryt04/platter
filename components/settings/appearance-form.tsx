'use client'
import { useTheme } from 'next-themes'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

export function AppearanceForm() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  return (
    <div className="space-y-4">
      <RadioGroup
        value={theme}
        onValueChange={setTheme}
        aria-label="Theme preference"
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem id="theme-system" value="system" />
          <span>
            <Label htmlFor="theme-system">System</Label>
            <span className="text-muted-foreground mt-1 block text-sm">
              Follow your device. Currently resolved to{' '}
              {resolvedTheme ?? 'system'}.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem id="theme-light" value="light" />
          <span>
            <Label htmlFor="theme-light">Light</Label>
            <span className="text-muted-foreground mt-1 block text-sm">
              Use the bright Platter canvas.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem id="theme-dark" value="dark" />
          <span>
            <Label htmlFor="theme-dark">Dark</Label>
            <span className="text-muted-foreground mt-1 block text-sm">
              Use blue-charcoal surfaces.
            </span>
          </span>
        </label>
      </RadioGroup>
    </div>
  )
}
