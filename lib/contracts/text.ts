/**
 * Normalize values that are stored or rendered as plain text.
 *
 * Recipe content is never rendered as source HTML. Removing markup-shaped
 * input at the write boundary also keeps user-authored text safe for future
 * renderers and prevents imported markup from becoming active content.
 */
export function sanitizePlainText(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gi, (entity) => {
      const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
      }
      return entities[entity.toLowerCase()] ?? entity
    })
    .replace(
      /<\s*(script|style|iframe|object|embed|template|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ' ',
    )
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
