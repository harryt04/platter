import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function PublicHeader() {
  return (
    <header className="bg-background/95 sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 backdrop-blur md:flex-nowrap md:px-8 md:py-0">
      <Link
        href="/discover"
        className="font-display flex items-center gap-2 text-xl font-semibold sm:gap-3"
      >
        <span className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-md font-sans text-lg">
          P
        </span>
        Platter
      </Link>
      <nav className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button className="px-2 sm:px-4" variant="ghost" asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button className="px-2 sm:px-4" asChild>
          <Link href="/sign-up">Create account</Link>
        </Button>
      </nav>
    </header>
  )
}
