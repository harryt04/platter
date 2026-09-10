import { PlaceholderPage } from '@/components/states/placeholder-page'
export default function NewRecipePage() {
  return (
    <PlaceholderPage
      title="Create a recipe"
      description="Capture a title, yield, ingredients, directions, and source details. Save a draft when the details need review."
      action="Back to my recipes"
      actionHref="/my-recipes"
    />
  )
}
