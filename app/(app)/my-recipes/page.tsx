import { EmptyState } from '@/components/states/empty-state'
import { PlaceholderPage } from '@/components/states/placeholder-page'
export default function MyRecipesPage() {
  return (
    <PlaceholderPage
      title="My recipes"
      description="Keep private recipes and imported versions together. Search and editing arrive with the Recipes feature."
      action="Create a recipe"
      actionHref="/recipes/new"
    >
      <EmptyState
        title="Your recipe library is empty"
        description="Create a recipe or import one from a public URL to start your private library."
        action="Create a recipe"
        href="/recipes/new"
      />
    </PlaceholderPage>
  )
}
