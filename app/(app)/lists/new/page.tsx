import { CreateListForm } from '@/components/lists/create-list-form'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export default function NewListPage() {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Your lists"
        title="Create a list"
        description="Name a persistent shared space for a household, group, or personal shopping run."
      />
      <CreateListForm />
    </ContentContainer>
  )
}
