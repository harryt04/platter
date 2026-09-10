import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function PublicHeader() {
  return (
    <header className="bg-background/95 sticky top-0 z-20 flex min-h-16 items-center justify-between border-b px-4 backdrop-blur md:px-8">
      <Link
        href="/discover"
        className="font-display flex items-center gap-3 text-xl font-semibold"
      >
        <span className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-md font-sans text-lg">
          P
        </span>
        Platter
      </Link>
      <nav className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/sign-up">Create account</Link>
        </Button>
      </nav>
    </header>
  )
}
