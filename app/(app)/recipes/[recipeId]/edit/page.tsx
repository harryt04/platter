import { notFound } from 'next/navigation'
import { DraftEditor } from '@/components/recipes/draft-editor'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  ownedRecipeFilter,
  recipeIdSchema,
  recipeShares,
  type RecipeDraftDocument,
  type RecipeShareDocument,
} from '@/lib/recipes/drafts'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'
import { RecipeSharing } from '@/components/recipes/recipe-sharing'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}) {
  const { recipeId } = await params
  if (!recipeIdSchema.safeParse(recipeId).success) notFound()
  const session = await requireSession(`/recipes/${recipeId}/edit`)
  const db = await getConnectedDatabase()
  const draft = await db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(ownedRecipeFilter(session.user.id, recipeId))
  if (!draft) notFound()
  const [lists, shares] = await Promise.all([
    db
      .collection<ListDocument>('lists')
      .find(listMembershipFilter(session.user.id))
      .sort({ updatedAt: -1 })
      .toArray(),
    recipeShares(db.collection<RecipeShareDocument>('recipe_shares'))
      .find({ recipeId })
      .toArray(),
  ])

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={
          draft.visibility === 'public'
            ? 'Published recipe'
            : draft.visibility === 'list-shared'
              ? 'Shared recipe'
              : 'Private recipe draft'
        }
        title="Edit recipe"
        description="Keep shaping this recipe. Its visibility changes only when you explicitly share or publish it."
      />
      {draft.derivedFrom && (
        <p className="text-muted-foreground mb-6 text-sm" role="status">
          This private variant started from published version{' '}
          {draft.derivedFrom.versionNumber}. Saving changes here will not alter
          the published recipe.
        </p>
      )}
      <DraftEditor
        recipeId={recipeId}
        initialTitle={draft.title}
        initialDescription={draft.description}
        initialTypicalPeopleFed={draft.typicalPeopleFed}
        initialPrepTimeMinutes={draft.prepTimeMinutes}
        initialCookingTimeMinutes={draft.cookingTimeMinutes}
        initialTotalTimeMinutes={draft.totalTimeMinutes}
        initialCuisine={draft.cuisine}
        initialMealType={draft.mealType}
        initialHouseholdNotes={draft.householdNotes}
        initialSourceName={draft.sourceName}
        initialSourceUrl={draft.sourceUrl}
        initialSourceAuthor={draft.sourceAuthor}
        initialAttribution={draft.attribution}
        initialImage={draft.image}
        initialNutrition={draft.nutrition}
        initialTags={draft.tags}
        initialDietaryLabels={draft.dietaryLabels}
        initialIngredients={draft.ingredients}
        initialInstructions={draft.instructions}
      />
      <RecipeSharing
        recipeId={recipeId}
        status={draft.status}
        origin={draft.origin ?? 'authored'}
        visibility={draft.visibility}
        lists={lists.map((list) => ({
          id: list._id,
          name: list.name,
          status: list.status,
        }))}
        initialSharedListIds={shares.map((share) => share.listId)}
      />
    </ContentContainer>
  )
}
