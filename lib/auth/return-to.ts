/**
 * Keep post-authentication navigation on the same origin. A relative path is
 * useful for preserving an invitation or recipe handoff, while protocol and
 * protocol-relative URLs must never be accepted from request input.
 */
export function safeReturnPath(value: string | null | undefined) {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/lists'

  try {
    const resolved = new URL(value, 'https://platter.invalid')
    return resolved.origin === 'https://platter.invalid' ? value : '/lists'
  } catch {
    return '/lists'
  }
}
