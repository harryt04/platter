import { describe, expect, it, vi } from 'vitest'
import {
  fetchRecipeSource,
  isBlockedRecipeImportAddress,
  RecipeImportFetchError,
  type ResolvedAddress,
} from '@/lib/recipe-import-fetcher'

const publicAddress: ResolvedAddress = { address: '93.184.216.34', family: 4 }

function response(
  status: number,
  headers: Record<string, string | undefined>,
  body: string | Uint8Array = '<html>recipe</html>',
) {
  return { status, headers, body }
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise
    throw new Error('Expected fetch to fail.')
  } catch (error) {
    expect(error).toBeInstanceOf(RecipeImportFetchError)
    return (error as RecipeImportFetchError).code
  }
}

describe('recipe import source fetching', () => {
  it('pins the request to a validated address and accepts bounded HTML', async () => {
    const lookupHost = vi.fn().mockResolvedValue([publicAddress])
    const request = vi
      .fn()
      .mockResolvedValue(
        response(200, { 'content-type': 'text/html; charset=utf-8' }),
      )

    await expect(
      fetchRecipeSource('https://recipes.example.test/one', {
        lookupHost,
        request,
      }),
    ).resolves.toMatchObject({
      requestedUrl: 'https://recipes.example.test/one',
      finalUrl: 'https://recipes.example.test/one',
      contentType: 'text/html',
      body: '<html>recipe</html>',
      byteLength: 19,
    })
    expect(lookupHost).toHaveBeenCalledWith('recipes.example.test')
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: new URL('https://recipes.example.test/one'),
        address: publicAddress,
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it.each([
    ['loopback', '127.0.0.1', 4],
    ['private', '10.0.0.4', 4],
    ['link-local', '169.254.169.254', 4],
    ['reserved', '192.0.2.4', 4],
    ['multicast', '224.0.0.1', 4],
    ['IPv6 loopback', '::1', 6],
    ['IPv6 unique local', 'fd00::4', 6],
    ['IPv6 link-local', 'fe80::4', 6],
    ['IPv6 multicast', 'ff02::1', 6],
    ['IPv6 documentation', '2001:db8::4', 6],
  ])('blocks %s resolved addresses', (_label, address, family) => {
    expect(isBlockedRecipeImportAddress(address, family as 4 | 6)).toBe(true)
  })

  it('rejects DNS rebinding candidates when any resolution is unsafe', async () => {
    const request = vi.fn()
    const code = await failure(
      fetchRecipeSource('https://rebind.example.test/recipe', {
        lookupHost: vi
          .fn()
          .mockResolvedValue([
            publicAddress,
            { address: '127.0.0.1', family: 4 },
          ]),
        request,
      }),
    )

    expect(code).toBe('BLOCKED_TARGET')
    expect(request).not.toHaveBeenCalled()
  })

  it('resolves and validates every redirect before following it', async () => {
    const lookupHost = vi
      .fn()
      .mockImplementation(async (hostname: string) =>
        hostname === 'safe.example.test'
          ? [publicAddress]
          : [{ address: '127.0.0.1', family: 4 }],
      )
    const request = vi
      .fn()
      .mockResolvedValue(
        response(302, { location: 'http://blocked.example.test/recipe' }),
      )

    const code = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost,
        request,
      }),
    )

    expect(code).toBe('REDIRECT_BLOCKED')
    expect(lookupHost).toHaveBeenNthCalledWith(1, 'safe.example.test')
    expect(lookupHost).toHaveBeenNthCalledWith(2, 'blocked.example.test')
    expect(request).toHaveBeenCalledOnce()
  })

  it('limits redirect hops', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(response(302, { location: '/again' }))
    const code = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost: vi.fn().mockResolvedValue([publicAddress]),
        request,
        maxRedirects: 2,
      }),
    )

    expect(code).toBe('REDIRECT_LIMIT_EXCEEDED')
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('rejects unsupported types and oversized responses before parsing', async () => {
    const unsupported = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost: vi.fn().mockResolvedValue([publicAddress]),
        request: vi
          .fn()
          .mockResolvedValue(
            response(200, { 'content-type': 'application/pdf' }),
          ),
      }),
    )
    const oversized = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost: vi.fn().mockResolvedValue([publicAddress]),
        request: vi.fn().mockResolvedValue(
          response(200, {
            'content-type': 'text/html',
            'content-length': '11',
          }),
        ),
        maxResponseBytes: 10,
      }),
    )

    expect(unsupported).toBe('UNSUPPORTED_CONTENT_TYPE')
    expect(oversized).toBe('RESPONSE_TOO_LARGE')
  })

  it('enforces the response byte limit while streaming', async () => {
    const body = (async function* () {
      yield new TextEncoder().encode('12345')
      yield new TextEncoder().encode('67890')
      yield new TextEncoder().encode('!')
    })()
    const code = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost: vi.fn().mockResolvedValue([publicAddress]),
        request: vi
          .fn()
          .mockResolvedValue(
            response(200, { 'content-type': 'text/html' }, body as never),
          ),
        maxResponseBytes: 10,
      }),
    )

    expect(code).toBe('RESPONSE_TOO_LARGE')
  })

  it('aborts slow upstream work at the total duration limit', async () => {
    const request = vi.fn().mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const code = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost: vi.fn().mockResolvedValue([publicAddress]),
        request,
        timeoutMs: 5,
      }),
    )

    expect(code).toBe('TIMEOUT')
  })

  it('also applies the duration limit while DNS or the response body is stalled', async () => {
    const dnsCode = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost: () => new Promise<ResolvedAddress[]>(() => undefined),
        timeoutMs: 5,
      }),
    )
    const body = (async function* () {
      await new Promise<void>(() => undefined)
      yield new TextEncoder().encode('never reached')
    })()
    const bodyCode = await failure(
      fetchRecipeSource('https://safe.example.test/recipe', {
        lookupHost: vi.fn().mockResolvedValue([publicAddress]),
        request: vi
          .fn()
          .mockResolvedValue(
            response(200, { 'content-type': 'text/html' }, body as never),
          ),
        timeoutMs: 5,
      }),
    )

    expect(dnsCode).toBe('TIMEOUT')
    expect(bodyCode).toBe('TIMEOUT')
  })

  it('never accepts credentials in the submitted or redirected URL', async () => {
    const lookupHost = vi.fn().mockResolvedValue([publicAddress])
    const request = vi.fn().mockResolvedValue(
      response(302, {
        location: 'https://user:secret@safe.example.test/next',
      }),
    )

    expect(
      await failure(
        fetchRecipeSource('https://user:secret@safe.example.test/recipe', {
          lookupHost,
          request,
        }),
      ),
    ).toBe('INVALID_TARGET')
    expect(
      await failure(
        fetchRecipeSource('https://safe.example.test/recipe', {
          lookupHost,
          request,
        }),
      ),
    ).toBe('REDIRECT_BLOCKED')
  })
})
