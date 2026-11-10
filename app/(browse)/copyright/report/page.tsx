import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { ComplaintForm } from '@/components/recipes/complaint-form'

export default async function CopyrightReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ recipeId?: string; sourceUrl?: string }>
}) {
  const params = searchParams ? await searchParams : {}

  return (
    <ContentContainer>
      <PageHeader
        description="Prepare the details an operator needs to review a public recipe or source."
        eyebrow="Removal request"
        title="Report a copyright concern"
      />

      <ComplaintForm
        initialRecipeId={params.recipeId}
        initialSourceUrl={params.sourceUrl}
      />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Include these details</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Link to the public recipe or source at issue.</li>
            <li>Describe the material that should be reviewed or removed.</li>
            <li>Explain your relationship to that material.</li>
            <li>Provide a reply contact only if the operator needs one.</li>
          </ol>
          <p>
            Contact information is used only for this review. It is restricted
            from public recipe responses and general application logs. Do not
            include passwords, payment details, or private recipe and grocery
            content.
          </p>
          <p>
            Reports are rate-limited and enter a restricted operator review
            queue. Submitting a report does not grant access to private recipes
            or complaint records.
          </p>
          <Button asChild variant="outline">
            <Link href="/copyright">Review the removal policy</Link>
          </Button>
        </CardContent>
      </Card>
    </ContentContainer>
  )
}
