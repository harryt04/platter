import { ContentContainer } from '@/components/shell/page-header'
import { LoadingSkeleton } from '@/components/states/loading-skeleton'

export default function Loading() {
  return (
    <ContentContainer>
      <LoadingSkeleton />
    </ContentContainer>
  )
}
