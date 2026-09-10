import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export function PlaceholderPage({
  title,
  description,
  eyebrow = 'Foundation placeholder',
  action,
  actionHref = '/discover',
  children,
}: {
  title: string
  description: string
  eyebrow?: string
  action?: string
  actionHref?: string
  children?: React.ReactNode
}) {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          action ? (
            <Button asChild>
              <Link href={actionHref}>
                {action}
                <ArrowRight size={16} />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {children ?? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm">
              This screen establishes the final route, hierarchy, and states for
              the next feature lane.
            </p>
          </CardContent>
        </Card>
      )}
    </ContentContainer>
  )
}
