import { GroceryRow } from '@/components/patterns/grocery-row'
import { ManualOverride } from '@/components/patterns/manual-override'
import {
  ContentContainer,
  PageHeader,
  PageSection,
} from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import {
  findActiveShoppingRun,
  findListForMember,
  listAcceptsShoppingOperations,
} from '@/lib/lists'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'
import { generateGroceryItems } from '@/lib/recipes/groceries'
import { notFound } from 'next/navigation'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const session = await requireSession(`/lists/${listId}/review`)
  const list = await findListForMember(listId, session.user.id)
  if (!list) notFound()
  const isReadOnly = !listAcceptsShoppingOperations(list)
  const run = await findActiveShoppingRun(list)
  const db = await getConnectedDatabase()
  const resolvedSelections = run
    ? await resolveRunRecipeVersions(db, run.recipeSelections)
    : []
  const selections = run?.recipeSelections ?? []
  const groceryItems = generateGroceryItems({
    selections: resolvedSelections.flatMap(({ version }, index) => {
      const selection = selections[index]
      return selection && version ? [{ selection, version }] : []
    }),
  })

  return (
    <ContentContainer>
      <PageHeader
        eyebrow={list.name}
        title="Review at home"
        description="Check what you already have before you start shopping. The source recipes stay unchanged."
      />
      {isReadOnly && (
        <p className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 rounded-[var(--radius-card)] border p-4 text-sm">
          This list is archived. The shopping run is read-only until an owner
          unarchives it.
        </p>
      )}
      <PageSection title="Grocery items">
        {groceryItems.length > 0 ? (
          <div className="space-y-3">
            {groceryItems.map((item) => (
              <GroceryRow item={item} category="Other" key={item.id} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            This shopping run has no grocery items yet. Choose a recipe to add
            its ingredients.
          </p>
        )}
      </PageSection>
      <ManualOverride disabled={isReadOnly} />
    </ContentContainer>
  )
}
