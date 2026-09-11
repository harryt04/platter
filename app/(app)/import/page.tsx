import { RecipeImportForm } from '@/components/recipes/recipe-import-form'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { serverEnv } from '@/lib/env/server'
import {
  toRecipeImportSummary,
  type RecipeImportDocument,
} from '@/lib/recipe-imports'

export default async function ImportPage() {
  const session = await requireSession('/import')
  const db = await getConnectedDatabase()
  const imports = await db
    .collection<RecipeImportDocument>('recipe_imports')
    .find({ userId: session.user.id })
    .sort({ submittedAt: -1, _id: -1 })
    .limit(50)
    .toArray()

  return (
    <ContentContainer>
      <PageHeader
        description="Submit a public recipe URL while connected. Review the extracted facts before anything becomes part of your recipe library."
        eyebrow="Recipe import"
        title="Bring a recipe into Platter"
      />
      <RecipeImportForm
        importsEnabled={serverEnv().RECIPE_IMPORTS_ENABLED}
        initialImports={imports.map(toRecipeImportSummary)}
      />
    </ContentContainer>
  )
}
