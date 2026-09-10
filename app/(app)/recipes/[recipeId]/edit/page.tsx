import { PlaceholderPage } from '@/components/states/placeholder-page'
export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}) {
  const { recipeId } = await params
  return (
    <PlaceholderPage
      title="Edit recipe"
      description={`Recipe ${recipeId} will use a version-aware editor so existing shopping runs remain stable.`}
      action="Return to recipe"
      actionHref={`/recipes/${recipeId}`}
    />
  )
}
