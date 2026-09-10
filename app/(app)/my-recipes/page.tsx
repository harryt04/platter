import { EmptyState } from '@/components/states/empty-state'
import { DeleteDraftButton } from '@/components/recipes/delete-draft-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { findRecipeLibrary } from '@/lib/recipes/library'
import Link from 'next/link'

export default async function MyRecipesPage() {
  const session = await requireSession('/my-recipes')
  const db = await getConnectedDatabase()
  const recipes = await findRecipeLibrary(db, session.user.id)

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Your recipes"
        title="Recipe library"
        description="Keep your recipes and recipes shared through your current lists in one place."
        action={
          <Button asChild>
            <Link href="/recipes/new">Create a recipe</Link>
          </Button>
        }
      />
      {recipes.length === 0 ? (
        <EmptyState
          title="Your recipe library is empty"
          description="Start with a title. Your private draft will be ready when you are."
          action="Create a recipe"
          href="/recipes/new"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recipes.map(({ recipe, access, sharedListNames }) => (
            <Card key={recipe.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-data text-muted-foreground text-xs tracking-widest uppercase">
                      {access === 'shared'
                        ? `Shared with ${sharedListNames.join(', ')}`
                        : recipe.status !== 'usable'
                          ? 'Private draft'
                          : recipe.visibility === 'public'
                            ? 'Published recipe'
                            : recipe.visibility === 'list-shared'
                              ? 'Shared recipe'
                              : 'Ready to use'}
                    </p>
                    <CardTitle className="font-display mt-2 text-2xl">
                      {recipe.title}
                    </CardTitle>
                  </div>
                  <span className="bg-muted rounded-full px-2 py-1 text-xs">
                    {recipe.status === 'usable'
                      ? 'Usable recipe'
                      : 'Needs details'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  {access === 'owned' ? (
                    <Link href={`/recipes/${recipe.id}/edit`}>Edit draft</Link>
                  ) : (
                    <Link href={`/recipes/${recipe.id}`}>Open recipe</Link>
                  )}
                </Button>
                {access === 'owned' && (
                  <DeleteDraftButton
                    recipeId={recipe.id}
                    title={recipe.title}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ContentContainer>
  )
}
