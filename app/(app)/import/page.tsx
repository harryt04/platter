import { PlaceholderPage } from '@/components/states/placeholder-page'
export default function ImportPage() {
  return (
    <PlaceholderPage
      title="Import a recipe"
      description="Enter a public URL while connected. URL imports require internet access and are not queued offline; Platter will create an editable preview and explain what needs review before saving."
      action="Browse recipes"
      actionHref="/discover"
    />
  )
}
