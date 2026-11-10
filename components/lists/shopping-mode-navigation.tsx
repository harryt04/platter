import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function ShoppingModeNavigation({
  listId,
  mode,
}: {
  listId: string
  mode: 'review' | 'shopping'
}) {
  const href =
    mode === 'review' ? `/lists/${listId}/shop` : `/lists/${listId}/review`
  const label = mode === 'review' ? 'Start shopping' : 'Review at home'

  return (
    <nav
      aria-label="Shopping run views"
      className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
    >
      <Button className="w-full sm:w-auto" variant="outline" asChild>
        <Link href={href}>{label}</Link>
      </Button>
    </nav>
  )
}
