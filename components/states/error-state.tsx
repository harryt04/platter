'use client'
import { Button } from '@/components/ui/button'

export function ErrorState({
  area,
  reset,
}: {
  area: string
  reset?: () => void
}) {
  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <h1 className="font-display text-2xl">We couldn’t load {area}.</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Try again, or return to the last screen you were using.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
