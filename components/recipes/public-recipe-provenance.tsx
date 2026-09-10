export function PublicRecipeProvenance({
  sourceName,
  sourceUrl,
  sourceAuthor,
  attribution,
  versionNumber,
  imageLicense,
}: {
  sourceName: string
  sourceUrl?: string
  sourceAuthor?: string
  attribution?: string
  versionNumber: number
  imageLicense?: string
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
      {imageLicense && (
        <div>
          <p className="font-medium">Image rights</p>
          <p className="font-data text-muted-foreground break-words">
            {imageLicense}
          </p>
        </div>
      )}
    </div>
  )
}
