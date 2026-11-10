import { DraftEditor } from '@/components/recipes/draft-editor'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export default function NewRecipePage() {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Private recipe"
        title="Create a recipe"
        description="Start with the name of a dish. Your draft stays private while you build it."
      />
      <DraftEditor />
    </ContentContainer>
  )
}
