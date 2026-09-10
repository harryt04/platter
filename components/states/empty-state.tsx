import { Button } from '@/components/ui/button'

export function EmptyState({
  title,
  description,
  action,
  href,
}: {
  title: string
  description: string
  action: string
  href: string
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed p-8 text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
        {description}
      </p>
      <Button asChild className="mt-6">
        <a href={href}>{action}</a>
      </Button>
    </div>
  )
}
