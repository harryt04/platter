import { Search } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RecipeCard } from '@/components/patterns/recipe-card'
import { EmptyState } from '@/components/states/empty-state'
import { LoadingSkeleton } from '@/components/states/loading-skeleton'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'

export default function DiscoverPage() {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Public discovery"
        title="Find something to cook"
        description="Search public recipes and keep the source and ingredient details in view."
        action={
          <Button asChild>
            <Link href="/recipes/new">Create a recipe</Link>
          </Button>
        }
      />
      <div className="mb-8 flex gap-2">
        <Input
          aria-label="Search recipes"
          placeholder="Search recipes, ingredients, or cuisines"
        />
        <Button aria-label="Search">
          <Search size={16} />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <RecipeCard
          title="Tacos"
          source="Platter community"
          href="/recipes/tacos"
        />
        <RecipeCard
          title="Weeknight curry"
          source="Platter community"
          href="/recipes/curry"
        />
      </div>
      <div className="mt-8">
        <LoadingSkeleton />
      </div>
      <div className="mt-8">
        <EmptyState
          title="No more recipes"
          description="Try another ingredient or cuisine to find a useful next step."
          action="Browse all recipes"
          href="/discover"
        />
      </div>
    </ContentContainer>
  )
}
