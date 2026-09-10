import { EmptyState } from '@/components/states/empty-state'
import { DeleteDraftButton } from '@/components/recipes/delete-draft-button'
import { SavePublicRecipeButton } from '@/components/recipes/save-public-recipe-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  decodeRecipeLibraryCursor,
  searchRecipeLibrary,
} from '@/lib/recipes/library'
import Link from 'next/link'

type SearchParams = {
  q?: string
  cursor?: string
}

export default async function MyRecipesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const session = await requireSession('/my-recipes')
  const db = await getConnectedDatabase()
  const params = (await searchParams) ?? {}
  const searchText = params.q?.trim() ?? ''
  const cursor =
    params.cursor && decodeRecipeLibraryCursor(params.cursor)
      ? params.cursor
      : undefined
  const page = await searchRecipeLibrary(db, session.user.id, {
    text: searchText,
    cursor,
  })
  const recipes = page.entries
  const nextPageHref = page.nextCursor
    ? `/my-recipes?${new URLSearchParams({
        ...(searchText ? { q: searchText } : {}),
        cursor: page.nextCursor,
      }).toString()}`
    : undefined

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
      <form
        action="/my-recipes"
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        method="get"
      >
        <div className="flex-1">
          <label className="text-sm font-medium" htmlFor="library-search">
            Search your library
          </label>
          <p className="text-muted-foreground mt-1 text-xs">
            Search titles, ingredients, sources, and tags.
          </p>
          <Input
            className="mt-2"
            defaultValue={searchText}
            id="library-search"
            name="q"
            placeholder="Try ‘onion’ or ‘weeknight’"
            type="search"
          />
        </div>
        <Button type="submit">Search library</Button>
        {searchText && (
          <Button asChild variant="outline">
            <Link href="/my-recipes">Clear</Link>
          </Button>
        )}
      </form>
      {recipes.length === 0 ? (
        <EmptyState
          title={
            searchText
              ? 'No recipes match that search'
              : 'Your recipe library is empty'
          }
          description={
            searchText
              ? 'Try a different title, ingredient, source, or tag.'
              : 'Start with a title. Your private draft will be ready when you are.'
          }
          action={searchText ? 'Clear search' : 'Create a recipe'}
          href={searchText ? '/my-recipes' : '/recipes/new'}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {recipes.map(({ recipe, access, sharedListNames }) => (
              <Card key={recipe.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-data text-muted-foreground text-xs tracking-widest uppercase">
                        {access === 'shared'
                          ? `Shared with ${sharedListNames.join(', ')}`
                          : access === 'saved'
                            ? 'Saved public recipe'
                            : recipe.origin === 'imported'
                              ? 'Imported recipe'
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
                      <Link href={`/recipes/${recipe.id}/edit`}>
                        Edit draft
                      </Link>
                    ) : (
                      <Link href={`/recipes/${recipe.id}`}>Open recipe</Link>
                    )}
                  </Button>
                  {access === 'owned' && (
                    <DeleteDraftButton
                      recipeId={recipe.id}
                      sharedListNames={sharedListNames}
                      title={recipe.title}
                    />
                  )}
                  {access === 'saved' && (
                    <SavePublicRecipeButton initialSaved recipeId={recipe.id} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {nextPageHref && (
            <div className="mt-6 flex justify-center">
              <Button asChild variant="outline">
                <Link href={nextPageHref}>Next recipes</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </ContentContainer>
  )
}
