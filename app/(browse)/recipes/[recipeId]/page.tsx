import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { PublicRecipeAuthPrompt } from '@/components/recipes/public-recipe-auth-prompt'
import { PublicRecipeIngredients } from '@/components/recipes/public-recipe-ingredients'
import { PublicRecipeProvenance } from '@/components/recipes/public-recipe-provenance'
import { SavePublicRecipeButton } from '@/components/recipes/save-public-recipe-button'
import { AddRecipeToListForm } from '@/components/recipes/add-recipe-to-list-form'
import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  listMembershipFilter,
  type ListDocument,
  type ShoppingRunDocument,
} from '@/lib/lists'
import {
  getRecipeSourceMetadata,
  isRecipeImagePubliclyPermitted,
  publicRecipeFilter,
  recipeIdSchema,
  toRecipeDraftForViewer,
} from '@/lib/recipes/drafts'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

export default async function RecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}) {
  const { recipeId } = await params
  if (!recipeIdSchema.safeParse(recipeId).success) notFound()
  const session = await getSession()
  const db = await getConnectedDatabase()
  const document = await db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(publicRecipeFilter(recipeId))
  if (!document) notFound()
  const recipe = toRecipeDraftForViewer(document, 'public')
  const saved = session
    ? await db.collection('recipe_saves').findOne({
        userId: session.user.id,
        recipeId,
      })
    : null
  const memberLists = session
    ? await db
        .collection<ListDocument>('lists')
        .find({
          ...listMembershipFilter(session.user.id),
          status: 'active',
        })
        .sort({ updatedAt: -1 })
        .toArray()
    : []
  const activeRuns =
    memberLists.length > 0
      ? await db
          .collection<ShoppingRunDocument>('shopping_runs')
          .find({
            listId: { $in: memberLists.map((list) => list._id) },
            state: 'active',
          })
          .project({ _id: 1, revision: 1 })
          .toArray()
      : []
  const revisionsByRunId = new Map(
    activeRuns.map((run) => [run._id, run.revision]),
  )
  const imageIsPermitted = isRecipeImagePubliclyPermitted(document.image)
  const imageRightsAreUnknown = Boolean(document.image && !imageIsPermitted)
  const { sourceName, sourceUrl, sourceAuthor } =
    getRecipeSourceMetadata(recipe)

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Public recipe"
        title={recipe.title}
        description={recipe.description}
      />
      {session && (
        <div className="mb-6">
          <SavePublicRecipeButton
            initialSaved={Boolean(saved)}
            recipeId={recipe.id}
          />
        </div>
      )}
      {session && recipe.typicalPeopleFed && memberLists.length > 0 && (
        <div className="mb-6">
          <AddRecipeToListForm
            defaultPeople={recipe.typicalPeopleFed}
            lists={memberLists.map((list) => ({
              id: list._id,
              name: list.name,
              activeRunId: list.activeRunId,
              activeRunRevision: revisionsByRunId.get(list.activeRunId),
            }))}
            recipeId={recipe.recipeId}
            recipeTitle={recipe.title}
            locale={session.user.locale ?? 'en-US'}
          />
        </div>
      )}
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
      ) : imageRightsAreUnknown ? (
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
            <PublicRecipeIngredients ingredients={recipe.ingredients} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recipe details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {recipe.cuisine && (
                <Badge variant="outline">{recipe.cuisine}</Badge>
              )}
              {recipe.mealType && (
                <Badge variant="outline">{recipe.mealType}</Badge>
              )}
            </div>
            <PublicRecipeProvenance
              attribution={recipe.attribution}
              imageLicense={document.image?.license ?? undefined}
              imageRightsStatus={document.image?.rightsStatus}
              sourceAuthor={sourceAuthor}
              sourceName={sourceName}
              sourceUrl={sourceUrl}
              sourceAvailability={recipe.importProvenance?.sourceAvailability}
              versionNumber={recipe.versionNumber}
            />
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
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link
            href={`/copyright/report?recipeId=${encodeURIComponent(recipe.recipeId)}`}
          >
            Report a concern about this recipe
          </Link>
        </Button>
      </div>
      {!session && <PublicRecipeAuthPrompt recipeId={recipe.id} />}
    </ContentContainer>
  )
}
