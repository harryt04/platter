import { PublicRecipeFinder } from '@/components/admin/public-recipe-finder'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { requireAdmin } from '@/lib/auth/authorization'
import {
  adminPublicRecipeSearchParamsSchema,
  findAdminPublicRecipes,
} from '@/lib/admin-public-recipes'
import { getConnectedDatabase } from '@/lib/db/mongo-client'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminPublicRecipesPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  await requireAdmin()
  const params = (await searchParams) ?? {}
  const parsedSearch = adminPublicRecipeSearchParamsSchema.safeParse({
    field: firstParam(params.field),
    q: firstParam(params.q),
    limit: firstParam(params.limit),
  })
  const parsed = parsedSearch.success
    ? parsedSearch.data
    : adminPublicRecipeSearchParamsSchema.parse({})
  const recipes = await findAdminPublicRecipes(
    await getConnectedDatabase(),
    parsed,
  )

  return (
    <ContentContainer>
      <PageHeader
        description="Find usable public content by recipe ID, source URL, domain, importer, or content fingerprint. Private recipe fields stay outside this workflow."
        eyebrow="Administration"
        title="Public recipes"
      />
      <PublicRecipeFinder
        field={parsed.field}
        initialRecipes={recipes}
        query={parsed.q}
      />
    </ContentContainer>
  )
}
