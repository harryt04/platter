import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RecipeCard } from '@/components/patterns/recipe-card'
import { EmptyState } from '@/components/states/empty-state'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { MongoRecipeSearchProvider } from '@/lib/search/mongo-provider'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const params = (await searchParams) ?? {}
  const query = firstParam(params.q)?.trim() ?? ''
  const cuisine = firstParam(params.cuisine)?.trim() ?? ''
  const tags = firstParam(params.tags)?.trim() ?? ''
  const dietaryLabels = firstParam(params.dietaryLabels)?.trim() ?? ''
  const cursor = firstParam(params.cursor)?.trim() ?? ''
  const db = await getConnectedDatabase()
  const page = await new MongoRecipeSearchProvider(db).searchRecipes({
    text: query,
    cursor: cursor || undefined,
    filters: {
      ...(cuisine ? { cuisine } : {}),
      ...(tags
        ? {
            tags: tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          }
        : {}),
      ...(dietaryLabels
        ? {
            dietaryLabels: dietaryLabels
              .split(',')
              .map((label) => label.trim())
              .filter(Boolean),
          }
        : {}),
    },
  })
  const { results } = page

  const nextPageParams = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(cuisine ? { cuisine } : {}),
    ...(tags ? { tags } : {}),
    ...(dietaryLabels ? { dietaryLabels } : {}),
    ...(page.nextCursor ? { cursor: page.nextCursor } : {}),
  })

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Public discovery"
        title="Find something to cook"
        description="Search public recipes and keep the source and ingredient details in view."
        action={
          <Button asChild>
            <Link href="/recipes/new">Create a recipe</Link>
          </Button>
        }
      />
      <form className="mb-8 grid gap-3 sm:grid-cols-2" method="get">
        <Input
          aria-label="Search recipes"
          className="sm:col-span-2"
          defaultValue={query}
          name="q"
          placeholder="Search titles, ingredients, sources, or labels"
        />
        <Input
          aria-label="Filter by cuisine"
          defaultValue={cuisine}
          name="cuisine"
          placeholder="Cuisine, such as Italian"
        />
        <Input
          aria-label="Filter by tags"
          defaultValue={tags}
          name="tags"
          placeholder="Tags, separated by commas"
        />
        <Input
          aria-label="Filter by dietary labels"
          defaultValue={dietaryLabels}
          name="dietaryLabels"
          placeholder="Dietary labels, separated by commas"
        />
        <div className="flex items-center gap-2">
          <Button type="submit">Search</Button>
          {(query || cuisine || tags || dietaryLabels) && (
            <Button asChild variant="outline">
              <Link href="/discover">Clear filters</Link>
            </Button>
          )}
        </div>
      </form>
      {results.length > 0 ? (
        <section aria-labelledby="discovery-results-heading">
          <h2
            id="discovery-results-heading"
            className="mb-4 text-lg font-semibold"
          >
            {query ? `Recipes matching “${query}”` : 'Public recipes'}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                title={recipe.title}
                source={recipe.source}
                sourceUrl={recipe.sourceUrl}
                sourceAuthor={recipe.sourceAuthor}
                attribution={recipe.attribution}
                href={`/recipes/${recipe.id}`}
                summary={recipe.summary}
                typicalPeopleFed={recipe.typicalPeopleFed}
                cuisine={recipe.cuisine}
                tags={recipe.tags}
                image={recipe.image}
              />
            ))}
          </div>
          {page.nextCursor && (
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link href={`/discover?${nextPageParams.toString()}`}>
                  Load more recipes
                </Link>
              </Button>
            </div>
          )}
        </section>
      ) : (
        <EmptyState
          title={
            query
              ? `No public recipes match “${query}”`
              : 'No public recipes yet'
          }
          description={
            query
              ? 'Try another title, ingredient, source, cuisine, tag, or dietary label.'
              : 'Public recipes will appear here when they are ready to share.'
          }
          action={query ? 'Browse all recipes' : 'Create a recipe'}
          href={query ? '/discover' : '/recipes/new'}
        />
      )}
    </ContentContainer>
  )
}
