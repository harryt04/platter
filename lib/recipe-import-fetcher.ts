import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import type { IncomingMessage } from 'node:http'
import { recipeImportUrlSchema } from '@/lib/recipe-imports'

export const recipeImportFetchDefaults = {
  maxRedirects: 5,
  maxResponseBytes: 2 * 1024 * 1024,
  timeoutMs: 10_000,
} as const

export type RecipeImportFetchErrorCode =
  | 'INVALID_TARGET'
  | 'BLOCKED_TARGET'
  | 'DNS_LOOKUP_FAILED'
  | 'REDIRECT_LIMIT_EXCEEDED'
  | 'REDIRECT_BLOCKED'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'RESPONSE_TOO_LARGE'
  | 'TIMEOUT'
  | 'UPSTREAM_FAILURE'

export class RecipeImportFetchError extends Error {
  readonly code: RecipeImportFetchErrorCode

  constructor(code: RecipeImportFetchErrorCode) {
    super(code)
    this.name = 'RecipeImportFetchError'
    this.code = code
  }
}

export type ResolvedAddress = {
  address: string
  family: 4 | 6
}

type RecipeImportResponse = {
  status: number
  headers: Record<string, string | undefined>
  body: AsyncIterable<Uint8Array> | Uint8Array | string
}

type RecipeImportRequest = (input: {
  url: URL
  address: ResolvedAddress
  signal: AbortSignal
}) => Promise<RecipeImportResponse>

type RecipeImportFetcherOptions = {
  maxRedirects?: number
  maxResponseBytes?: number
  timeoutMs?: number
  lookupHost?: (hostname: string) => Promise<ResolvedAddress[]>
  request?: RecipeImportRequest
}

export type RecipeImportFetchResult = {
  requestedUrl: string
  finalUrl: string
  contentType: string
  body: string
  byteLength: number
}

function blockedIpv4(address: string) {
  const octets = address.split('.').map(Number)
  const [first, second, third] = octets
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return true
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && second >= 18 && second <= 19) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  )
}

function ipv6ToBigInt(address: string) {
  const [withoutZone] = address.split('%')
  const halves = withoutZone.split('::')
  if (halves.length > 2) return null

  const parseGroup = (group: string) => {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    return Number.parseInt(group, 16)
  }

  const left = halves[0] ? halves[0].split(':').map(parseGroup) : []
  const right = halves[1] ? halves[1].split(':').map(parseGroup) : []
  if (
    left.some((group) => group === null) ||
    right.some((group) => group === null)
  ) {
    return null
  }

  const groups =
    halves.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill(0), ...right]
      : [...left]
  if (groups.length !== 8) return null

  return groups.reduce(
    (value, group) => (value << 16n) | BigInt(group ?? 0),
    0n,
  )
}

function blockedIpv6(address: string) {
  const value = ipv6ToBigInt(address)
  if (value === null) return true

  const prefix = (bits: bigint) => value >> (128n - bits)
  const isIpv4Mapped = prefix(80n) === 0n && prefix(96n) === 0xffffn
  if (isIpv4Mapped) {
    const ipv4 = [24n, 16n, 8n, 0n]
      .map((shift) => Number((value >> shift) & 0xffn))
      .join('.')
    return blockedIpv4(ipv4)
  }

  return (
    value === 0n ||
    value === 1n ||
    prefix(7n) === 0b1111110n ||
    prefix(7n) === 0b1111111n ||
    prefix(10n) === 0b1111111010n ||
    prefix(8n) === 0b11111111n ||
    prefix(32n) === 0x20010db8n ||
    prefix(96n) === 0n
  )
}

export function isBlockedRecipeImportAddress(address: string, family: 4 | 6) {
  return family === 4 ? blockedIpv4(address) : blockedIpv6(address)
}

function validateTarget(url: URL, redirect: boolean) {
  const parsed = recipeImportUrlSchema.safeParse(url.toString())
  if (!parsed.success || url.username || url.password) {
    throw new RecipeImportFetchError(
      redirect ? 'REDIRECT_BLOCKED' : 'INVALID_TARGET',
    )
  }
}

async function defaultLookupHost(hostname: string): Promise<ResolvedAddress[]> {
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true })
    return addresses.map(({ address, family }) => ({
      address,
      family: family as 4 | 6,
    }))
  } catch {
    throw new RecipeImportFetchError('DNS_LOOKUP_FAILED')
  }
}

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) throw new RecipeImportFetchError('TIMEOUT')

  let onAbort: (() => void) | undefined
  const aborted = new Promise<T>((_resolve, reject) => {
    onAbort = () => reject(new RecipeImportFetchError('TIMEOUT'))
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([promise, aborted])
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

async function resolveSafeHost(
  hostname: string,
  lookupHost: (hostname: string) => Promise<ResolvedAddress[]>,
  redirect: boolean,
  signal: AbortSignal,
) {
  let addresses: ResolvedAddress[]
  try {
    addresses = await withAbort(lookupHost(hostname), signal)
  } catch (error) {
    if (error instanceof RecipeImportFetchError) throw error
    throw new RecipeImportFetchError('DNS_LOOKUP_FAILED')
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address, family }) =>
      isBlockedRecipeImportAddress(address, family),
    )
  ) {
    throw new RecipeImportFetchError(
      redirect ? 'REDIRECT_BLOCKED' : 'BLOCKED_TARGET',
    )
  }
  return addresses[0]!
}

function headerValue(
  headers: Record<string, string | undefined>,
  name: string,
) {
  return Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name,
  )?.[1]
}

function contentTypeFor(headers: Record<string, string | undefined>) {
  const contentType = headerValue(headers, 'content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase()
  if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
    throw new RecipeImportFetchError('UNSUPPORTED_CONTENT_TYPE')
  }
  return contentType
}

function closeResponseBody(body: RecipeImportResponse['body']) {
  if (typeof body === 'object' && 'destroy' in body) {
    const destroyable = body as { destroy?: () => void }
    destroyable.destroy?.()
  }
}

async function readResponseBody(
  body: RecipeImportResponse['body'],
  maxResponseBytes: number,
  signal: AbortSignal,
) {
  const chunks: Uint8Array[] = []
  let byteLength = 0
  const iterable: AsyncIterable<Uint8Array> =
    typeof body === 'string' || body instanceof Uint8Array
      ? (async function* () {
          yield typeof body === 'string' ? new TextEncoder().encode(body) : body
        })()
      : body

  const iterator = iterable[Symbol.asyncIterator]()
  try {
    while (true) {
      const next = await withAbort(iterator.next(), signal)
      if (next.done) break
      const chunk = next.value
      byteLength += chunk.byteLength
      if (byteLength > maxResponseBytes) {
        throw new RecipeImportFetchError('RESPONSE_TOO_LARGE')
      }
      chunks.push(chunk)
    }
  } finally {
    const returned = iterator.return?.()
    if (returned) void Promise.resolve(returned).catch(() => undefined)
  }
  return { body: Buffer.concat(chunks), byteLength }
}

function requestPinned({
  url,
  address,
  signal,
}: Parameters<RecipeImportRequest>[0]): Promise<RecipeImportResponse> {
  const transport = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    let settled = false
    const request = transport.request(
      url,
      {
        method: 'GET',
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9',
          'user-agent': 'PlatterImporter/1.0',
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, address.address, address.family),
      },
      (response: IncomingMessage) => {
        settled = true
        resolve({
          status: response.statusCode ?? 0,
          headers: Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(',') : value,
            ]),
          ),
          body: response,
        })
      },
    )

    const abort = () => request.destroy(new RecipeImportFetchError('TIMEOUT'))
    if (signal.aborted) {
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    request.once('error', (error) => {
      signal.removeEventListener('abort', abort)
      if (settled && signal.aborted) return
      reject(
        error instanceof RecipeImportFetchError
          ? error
          : new RecipeImportFetchError('UPSTREAM_FAILURE'),
      )
    })
    request.end()
  })
}

export async function fetchRecipeSource(
  sourceUrl: string,
  options: RecipeImportFetcherOptions = {},
): Promise<RecipeImportFetchResult> {
  const maxRedirects =
    options.maxRedirects ?? recipeImportFetchDefaults.maxRedirects
  const maxResponseBytes =
    options.maxResponseBytes ?? recipeImportFetchDefaults.maxResponseBytes
  const timeoutMs = options.timeoutMs ?? recipeImportFetchDefaults.timeoutMs
  const lookupHost = options.lookupHost ?? defaultLookupHost
  const request = options.request ?? requestPinned
  const initialUrl = new URL(sourceUrl)
  validateTarget(initialUrl, false)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    let currentUrl = initialUrl
    let redirectCount = 0
    while (true) {
      validateTarget(currentUrl, redirectCount > 0)
      const address = await resolveSafeHost(
        currentUrl.hostname,
        lookupHost,
        redirectCount > 0,
        controller.signal,
      )
      let response: RecipeImportResponse
      try {
        response = await withAbort(
          request({
            url: currentUrl,
            address,
            signal: controller.signal,
          }),
          controller.signal,
        )
      } catch (error) {
        if (controller.signal.aborted) {
          throw new RecipeImportFetchError('TIMEOUT')
        }
        throw error instanceof RecipeImportFetchError
          ? error
          : new RecipeImportFetchError('UPSTREAM_FAILURE')
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount >= maxRedirects) {
          closeResponseBody(response.body)
          throw new RecipeImportFetchError('REDIRECT_LIMIT_EXCEEDED')
        }
        const location = headerValue(response.headers, 'location')
        if (!location) {
          closeResponseBody(response.body)
          throw new RecipeImportFetchError('REDIRECT_BLOCKED')
        }
        try {
          currentUrl = new URL(location, currentUrl)
          validateTarget(currentUrl, true)
        } catch (error) {
          closeResponseBody(response.body)
          if (error instanceof RecipeImportFetchError) throw error
          throw new RecipeImportFetchError('REDIRECT_BLOCKED')
        }
        closeResponseBody(response.body)
        redirectCount += 1
        continue
      }

      if (response.status < 200 || response.status >= 300) {
        throw new RecipeImportFetchError('UPSTREAM_FAILURE')
      }
      const contentLength = headerValue(response.headers, 'content-length')
      if (
        contentLength &&
        Number.isFinite(Number(contentLength)) &&
        Number(contentLength) > maxResponseBytes
      ) {
        throw new RecipeImportFetchError('RESPONSE_TOO_LARGE')
      }
      const contentType = contentTypeFor(response.headers)
      const result = await readResponseBody(
        response.body,
        maxResponseBytes,
        controller.signal,
      )
      return {
        requestedUrl: initialUrl.toString(),
        finalUrl: currentUrl.toString(),
        contentType,
        body: result.body.toString('utf8'),
        byteLength: result.byteLength,
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RecipeImportFetchError('TIMEOUT')
    }
    if (error instanceof RecipeImportFetchError) throw error
    throw new RecipeImportFetchError('UPSTREAM_FAILURE')
  } finally {
    clearTimeout(timeout)
  }
}

export function isRecipeImportFetchError(
  error: unknown,
): error is RecipeImportFetchError {
  return error instanceof RecipeImportFetchError
}
