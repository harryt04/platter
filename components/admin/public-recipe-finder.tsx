import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  AdminPublicRecipeSearchField,
  AdminPublicRecipeSummary,
} from '@/lib/admin-public-recipes'

const searchFields: Array<{
  value: AdminPublicRecipeSearchField
  label: string
}> = [
  { value: 'all', label: 'All supported fields' },
  { value: 'recipe-id', label: 'Recipe ID' },
  { value: 'url', label: 'Source URL' },
  { value: 'domain', label: 'Source domain' },
  { value: 'importer', label: 'Importer' },
  { value: 'fingerprint', label: 'Content fingerprint' },
]

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString()
}

export function PublicRecipeFinder({
  initialRecipes,
  field,
  query,
}: {
  initialRecipes: AdminPublicRecipeSummary[]
  field: AdminPublicRecipeSearchField
  query: string
}) {
  return (
    <>
      <Card className="mb-8">
        <CardContent className="p-6">
          <form
            className="grid gap-4 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end"
            method="get"
          >
            <div className="space-y-2">
              <Label htmlFor="public-recipe-search-field">Search by</Label>
              <select
                aria-label="Search by"
                className="bg-background focus:ring-ring min-h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm outline-none focus:ring-2"
                defaultValue={field}
                id="public-recipe-search-field"
                name="field"
              >
                {searchFields.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="public-recipe-search-query">Search value</Label>
              <Input
                aria-describedby="public-recipe-search-help"
                defaultValue={query}
                id="public-recipe-search-query"
                name="q"
                placeholder="Recipe ID, URL, domain, importer, or fingerprint"
              />
              <p
                className="text-muted-foreground text-xs"
                id="public-recipe-search-help"
              >
                Results include usable public records and records already marked
                suppressed.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Find content</Button>
              {(field !== 'all' || query) && (
                <Button asChild variant="outline">
                  <Link href="/admin/public-recipes">Clear</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {initialRecipes.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm">
              {query
                ? `No public content matched “${query}”.`
                : 'No public content is available to review yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <section aria-labelledby="public-recipe-results-heading">
          <h2
            className="mb-4 text-lg font-semibold"
            id="public-recipe-results-heading"
          >
            {query ? 'Matching public content' : 'Recent public content'}
          </h2>
          <div className="space-y-4">
            {initialRecipes.map((recipe) => (
              <Card key={recipe.id}>
                <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <CardTitle>{recipe.title}</CardTitle>
                    <p className="font-data text-muted-foreground text-xs break-all">
                      {recipe.id}
                    </p>
                  </div>
                  <Badge
                    variant={
                      recipe.visibility === 'suppressed' ? 'warning' : 'success'
                    }
                  >
                    {recipe.visibility === 'suppressed'
                      ? 'Suppressed'
                      : 'Public'}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs uppercase">
                      Source
                    </p>
                    <p>
                      {recipe.sourceName ??
                        recipe.sourceDomain ??
                        'Not provided'}
                      {recipe.sourceAuthor && ` · ${recipe.sourceAuthor}`}
                    </p>
                    {recipe.sourceUrl && (
                      <a
                        className="text-primary block break-all underline underline-offset-4"
                        href={recipe.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {recipe.sourceUrl}
                      </a>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs uppercase">
                      Import record
                    </p>
                    <p>
                      {recipe.importer ?? 'Manual recipe'}
                      {recipe.origin === 'imported' &&
                        ` · ${recipe.importReviewStatus ?? 'review status unavailable'}`}
                    </p>
                    {recipe.contentFingerprint && (
                      <p className="font-data text-xs break-all">
                        {recipe.contentFingerprint}
                      </p>
                    )}
                    {recipe.rightsStatus && (
                      <p className="text-muted-foreground text-xs">
                        Rights: {recipe.rightsStatus}
                      </p>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs sm:col-span-2">
                    Updated {formatTimestamp(recipe.updatedAt)}
                    {recipe.sourceAvailability === 'unavailable' &&
                      ' · Source unavailable'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
