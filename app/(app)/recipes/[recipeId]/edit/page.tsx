import { notFound } from 'next/navigation'
import { DraftEditor } from '@/components/recipes/draft-editor'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  privateDraftFilter,
  type RecipeDraftDocument,
} from '@/lib/recipes/drafts'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}) {
  const { recipeId } = await params
  const session = await requireSession(`/recipes/${recipeId}/edit`)
  const db = await getConnectedDatabase()
  const draft = await db
    .collection<RecipeDraftDocument>('recipes')
    .findOne(privateDraftFilter(session.user.id, recipeId))
  if (!draft) notFound()

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Private recipe draft"
        title="Edit recipe"
        description="Keep shaping this recipe. It remains private until you explicitly share or publish it."
      />
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
    </ContentContainer>
  )
}
