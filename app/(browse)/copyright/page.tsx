import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ContentContainer,
  PageHeader,
  PageSection,
} from '@/components/shell/page-header'

export default function CopyrightPage() {
  return (
    <ContentContainer>
      <PageHeader
        action={
          <Button asChild>
            <Link href="/copyright/report">Report a concern</Link>
          </Button>
        }
        description="If a public recipe or source uses your work without permission, tell the site operator what needs review."
        eyebrow="Public content policy"
        title="Copyright and removal"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>How to request removal</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>
              Use the removal-request page and identify the public recipe or
              source, the material you believe should be removed, and why you
              have authority to make the request.
            </p>
            <p>
              A specific recipe link or source URL helps the operator review the
              right public record. Do not send passwords, payment details, or
              private recipe and grocery content.
            </p>
            <Button asChild className="mt-2" variant="outline">
              <Link href="/copyright/report">
                Open the removal-request guide
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How contact details are handled</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>
              Contact details are collected only when they are needed to clarify
              or respond to a request. They are not shown on public recipe pages
              or included in general application logs.
            </p>
            <p>
              Operators should restrict complaint access to authorized review
              staff and retain only the minimum information needed for the
              review and its audit trail. This page describes product behavior,
              not jurisdiction-specific legal advice.
            </p>
            <p>
              Each hosted operator must configure and publish the policies,
              contacts, and removal or repeat-infringer processes required for
              its deployment and jurisdiction. Platter does not decide which
              legal obligations apply.
            </p>
          </CardContent>
        </Card>
      </div>

      <PageSection title="What happens next">
        <Card>
          <CardContent className="text-muted-foreground space-y-3 p-6 text-sm">
            <p>
              The operator reviews the identified public content and may ask for
              clarification. A removal request does not grant access to private
              recipes, shopping lists, or complaint records.
            </p>
            <p>
              Public recipe attribution and source links remain visible unless
              the reviewed content is removed or suppressed through the
              operator&apos;s moderation process.
            </p>
          </CardContent>
        </Card>
      </PageSection>
    </ContentContainer>
  )
}
