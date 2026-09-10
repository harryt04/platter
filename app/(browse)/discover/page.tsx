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
  const db = await getConnectedDatabase()
  const { results } = await new MongoRecipeSearchProvider(db).searchRecipes({
    text: query,
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
      <form className="mb-8 flex gap-2" method="get">
        <Input
          aria-label="Search recipes"
          defaultValue={query}
          name="q"
          placeholder="Search titles, ingredients, sources, or labels"
        />
        <Button type="submit">Search</Button>
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
                href={`/recipes/${recipe.id}`}
                summary={recipe.summary}
                typicalPeopleFed={recipe.typicalPeopleFed}
                cuisine={recipe.cuisine}
                tags={recipe.tags}
              />
            ))}
          </div>
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
