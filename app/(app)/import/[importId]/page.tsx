import { notFound } from 'next/navigation'
import { RecipeImportPreview } from '@/components/recipes/recipe-import-preview'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import {
  recipeImportIdSchema,
  type RecipeImportDocument,
} from '@/lib/recipe-imports'

export default async function RecipeImportPreviewPage({
  params,
}: {
  params: Promise<{ importId: string }>
}) {
  const { importId } = await params
  if (!recipeImportIdSchema.safeParse(importId).success) notFound()
  const session = await requireSession(`/import/${importId}`)
  const db = await getConnectedDatabase()
  const imported = await db
    .collection<RecipeImportDocument>('recipe_imports')
    .findOne({ _id: importId, userId: session.user.id })
  if (!imported?.preview || imported.status !== 'preview-ready') notFound()

  return (
    <ContentContainer>
      <PageHeader
        description="Review the source facts and correct the structured recipe before saving a private draft."
        eyebrow="Recipe import preview"
        title={imported.preview.title ?? 'Untitled imported recipe'}
      />
      <RecipeImportPreview
        candidate={imported.preview}
        importId={importId}
        savedRecipeId={imported.savedRecipeId}
      />
    </ContentContainer>
  )
}
