import { getSessionCookie } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const protectedPath =
    /^\/(lists|my-recipes|import|history|settings|recipes\/new|admin)/.test(
      request.nextUrl.pathname,
    )
  const authPath = /^\/(sign-in|sign-up|forgot-password|reset-password)/.test(
    request.nextUrl.pathname,
  )
  const hasSessionCookie = Boolean(getSessionCookie(request))

  if (protectedPath && !hasSessionCookie) {
    const url = new URL('/sign-in', request.url)
    url.searchParams.set(
      'returnTo',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(url)
  }
  if (authPath && hasSessionCookie)
    return NextResponse.redirect(new URL('/lists', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons).*)'],
}
