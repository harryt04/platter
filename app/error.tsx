'use client'
import { ErrorState } from '@/components/states/error-state'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState area="this page" reset={reset} />
}
