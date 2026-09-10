import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { publicRecipeFilter, toRecipeDraft } from '@/lib/recipes/drafts'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

export default async function RecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}) {
  const { recipeId } = await params
  const session = await getSession()
  const db = await getConnectedDatabase()
  const document = await db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(publicRecipeFilter(recipeId))
  if (!document) notFound()
  const recipe = toRecipeDraft(document)
  const imageIsPermitted =
    recipe.image &&
    ['user-owned', 'licensed', 'permission-granted'].includes(
      recipe.image.rightsStatus,
    )
  const sourceName = recipe.sourceName ?? 'Platter community'

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Public recipe"
        title={recipe.title}
        description={recipe.description}
        action={
          !session ? (
            <Button asChild variant="outline">
              <Link href={`/sign-in?returnTo=/recipes/${recipe.id}`}>
                Sign in to use this recipe
              </Link>
            </Button>
          ) : undefined
        }
      />
      {imageIsPermitted && recipe.image ? (
        <div className="bg-muted mb-6 overflow-hidden rounded-xl">
          <Image
            alt={recipe.image.altText ?? `${recipe.title} recipe`}
            className="max-h-[28rem] w-full object-cover"
            height={720}
            loader={({ src }) => src}
            src={recipe.image.url}
            unoptimized
            width={1280}
          />
        </div>
      ) : recipe.image ? (
        <p className="text-muted-foreground mb-6 text-sm" role="status">
          This source does not permit an image here. The recipe link is still
          available.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <p className="text-muted-foreground text-sm">
              {recipe.typicalPeopleFed
                ? `Typical yield: ${recipe.typicalPeopleFed} people`
                : 'Typical yield not provided'}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {recipe.ingredients.length > 0 ? (
              recipe.ingredients.map((ingredient, index) => (
                <div
                  className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                  key={`${ingredient.originalText}-${index}`}
                >
                  <span className="font-data text-right">
                    {[ingredient.quantity, ingredient.unit]
                      .filter(Boolean)
                      .join(' ') || 'As needed'}
                  </span>
                  <span className="text-right">
                    {ingredient.ingredientName}
                    {ingredient.preparationNote
                      ? `, ${ingredient.preparationNote}`
                      : null}
                    {ingredient.optional ? ' (optional)' : null}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No ingredients listed.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recipe details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Version {recipe.versionNumber}</Badge>
              {recipe.cuisine && (
                <Badge variant="outline">{recipe.cuisine}</Badge>
              )}
              {recipe.mealType && (
                <Badge variant="outline">{recipe.mealType}</Badge>
              )}
            </div>
            <div>
              <p className="font-medium">Source</p>
              <p className="text-muted-foreground">
                {recipe.sourceUrl ? (
                  <a
                    className="text-primary underline underline-offset-2"
                    href={recipe.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {sourceName}
                  </a>
                ) : (
                  sourceName
                )}
              </p>
            </div>
            {(recipe.sourceAuthor || recipe.attribution) && (
              <p className="text-muted-foreground">
                {recipe.sourceAuthor ? `By ${recipe.sourceAuthor}` : null}
                {recipe.sourceAuthor && recipe.attribution ? ' · ' : null}
                {recipe.attribution}
              </p>
            )}
            {recipe.image?.license && (
              <div>
                <p className="font-medium">Image rights</p>
                <p className="text-muted-foreground">{recipe.image.license}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Directions</CardTitle>
        </CardHeader>
        <CardContent>
          {recipe.instructions.length > 0 ? (
            <ol className="list-decimal space-y-4 pl-5 text-sm">
              {recipe.instructions.map((instruction, index) => (
                <li key={`${instruction}-${index}`}>{instruction}</li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">
              Directions have not been added yet.
            </p>
          )}
        </CardContent>
      </Card>
    </ContentContainer>
  )
}
