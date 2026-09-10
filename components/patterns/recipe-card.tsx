import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function RecipeCard({
  title,
  source = 'Platter community',
  href = '/recipes/tacos',
  summary,
  typicalPeopleFed,
  cuisine,
  tags = [],
}: {
  title: string
  source?: string
  href?: string
  summary?: string
  typicalPeopleFed?: number
  cuisine?: string
  tags?: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <BookOpen className="text-primary" size={20} />
          <Badge variant="outline">Public</Badge>
        </div>
        <CardTitle className="font-display text-2xl">
          <Link className="hover:text-primary" href={href}>
            {title}
          </Link>
        </CardTitle>
        <p className="font-data text-muted-foreground text-xs">
          Source: {source}
        </p>
        {(typicalPeopleFed || cuisine || tags.length > 0) && (
          <p className="text-muted-foreground mt-2 text-sm">
            {typicalPeopleFed ? `Feeds ${typicalPeopleFed} people` : null}
            {typicalPeopleFed && (cuisine || tags.length > 0) ? ' · ' : null}
            {cuisine}
            {cuisine && tags.length > 0 ? ' · ' : null}
            {tags.join(' · ')}
          </p>
        )}
        {summary && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
            {summary}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Link
          className="text-primary inline-flex min-h-11 items-center gap-2 text-sm font-medium"
          href={href}
        >
          Open recipe <ArrowRight size={16} />
        </Link>
      </CardContent>
    </Card>
  )
}
