import type { RecipeImportSourceAvailability } from '@/lib/recipe-imports'
import type { RecipeImageProvenance } from '@/lib/recipes/drafts'

function imageRightsLabel(status: RecipeImageProvenance['rightsStatus']) {
  switch (status) {
    case 'user-owned':
      return 'User-owned'
    case 'licensed':
      return 'Licensed for reuse'
    case 'permission-granted':
      return 'Permission granted'
    case 'unknown':
      return 'Unknown — not displayed publicly'
  }
}

export function PublicRecipeProvenance({
  sourceName,
  sourceUrl,
  sourceAuthor,
  attribution,
  versionNumber,
  imageLicense,
  imageRightsStatus,
  sourceAvailability,
}: {
  sourceName: string
  sourceUrl?: string
  sourceAuthor?: string
  attribution?: string
  versionNumber: number
  imageLicense?: string
  imageRightsStatus?: RecipeImageProvenance['rightsStatus']
  sourceAvailability?: RecipeImportSourceAvailability
}) {
  return (
    <div
      aria-label="Recipe provenance"
      className="space-y-4 text-sm"
      role="region"
    >
      <div>
        <p className="font-medium">Source</p>
        <p className="font-data text-muted-foreground break-words">
          {sourceUrl ? (
            <a
              className="text-primary underline underline-offset-2"
              href={sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {sourceName}
            </a>
          ) : (
            sourceName
          )}
        </p>
        {sourceAvailability === 'unavailable' && (
          <p className="text-warning mt-1 text-sm" role="status">
            Source currently unavailable. The recipe facts and attribution are
            preserved.
          </p>
        )}
      </div>
      {(sourceAuthor || attribution) && (
        <div>
          <p className="font-medium">Attribution</p>
          <p className="font-data text-muted-foreground break-words">
            {sourceAuthor ? `By ${sourceAuthor}` : null}
            {sourceAuthor && attribution ? ' · ' : null}
            {attribution}
          </p>
        </div>
      )}
      <div>
        <p className="font-medium">Version</p>
        <p className="font-data text-muted-foreground">{versionNumber}</p>
      </div>
      {(imageLicense || imageRightsStatus) && (
        <div>
          <p className="font-medium">Image rights</p>
          <p className="font-data text-muted-foreground break-words">
            {imageRightsStatus
              ? imageRightsLabel(imageRightsStatus)
              : imageLicense}
            {imageRightsStatus && imageLicense ? ` · ${imageLicense}` : null}
          </p>
        </div>
      )}
    </div>
  )
}
