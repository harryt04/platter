'use client'

import { createAuthClient } from 'better-auth/react'

// Let Better Auth resolve the same-origin `/api/auth` endpoint in the browser.
// A relative baseURL is invalid during Next.js server rendering.
export const authClient = createAuthClient()
