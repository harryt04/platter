import { EmptyState } from '@/components/states/empty-state'
import { DeleteDraftButton } from '@/components/recipes/delete-draft-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { type RecipeDraftDocument, toRecipeDraft } from '@/lib/recipes/drafts'
import Link from 'next/link'

export default async function MyRecipesPage() {
  const session = await requireSession('/my-recipes')
  const db = await getConnectedDatabase()
  const documents = await db
    .collection<RecipeDraftDocument>('recipes')
    .find({
      ownerId: session.user.id,
      status: { $in: ['draft', 'usable'] },
      visibility: 'private',
    })
    .sort({ updatedAt: -1 })
    .toArray()
  const drafts = documents.map(toRecipeDraft)

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Your recipes"
        title="My recipes"
        description="Keep private recipe ideas in one place. Add details when you’re ready."
        action={
          <Button asChild>
            <Link href="/recipes/new">Create a recipe</Link>
          </Button>
        }
      />
      {drafts.length === 0 ? (
        <EmptyState
          title="Your recipe library is empty"
          description="Start with a title. Your private draft will be ready when you are."
          action="Create a recipe"
          href="/recipes/new"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-data text-muted-foreground text-xs tracking-widest uppercase">
                      {draft.status === 'usable'
                        ? 'Ready to use'
                        : 'Private draft'}
                    </p>
                    <CardTitle className="font-display mt-2 text-2xl">
                      {draft.title}
                    </CardTitle>
                  </div>
                  <span className="bg-muted rounded-full px-2 py-1 text-xs">
                    {draft.status === 'usable'
                      ? 'Usable recipe'
                      : 'Needs details'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/recipes/${draft.id}/edit`}>Edit draft</Link>
                </Button>
                <DeleteDraftButton recipeId={draft.id} title={draft.title} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ContentContainer>
  )
}
