import { PlaceholderPage } from '@/components/states/placeholder-page'
export default function OfflinePage() {
  return (
    <PlaceholderPage
      title="You’re offline"
      description="Your saved shopping run is available on this device. Reconnect to load anything new or sync pending changes."
      action="Return to shopping run"
      actionHref="/lists"
    />
  )
}
