import { PlaceholderPage } from '@/components/states/placeholder-page'

export default function NotFound() {
  return (
    <PlaceholderPage
      title="Page not found"
      description="That Platter page is not available. Return to discovery to choose another recipe."
      action="Discover recipes"
      actionHref="/discover"
    />
  )
}
