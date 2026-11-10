import { z } from 'zod'

export type EntityId = string & { readonly __brand: 'EntityId' }
export type IsoDateTime = string & { readonly __brand: 'IsoDateTime' }
export type DecimalString = string & { readonly __brand: 'DecimalString' }

/** Shared route and event boundary for bounded opaque identifiers. */
export const opaqueIdSchema = z
  .string({ error: 'Enter an identifier.' })
  .trim()
  .min(1, 'Enter an identifier.')
  .max(200, 'Identifiers must be 200 characters or fewer.')
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    'Identifiers cannot contain control characters.',
  )

/** Shared route boundary for opaque, URL-safe pagination cursors. */
export const opaqueCursorSchema = z
  .string({ error: 'Enter a pagination cursor.' })
  .trim()
  .min(1, 'Enter a pagination cursor.')
  .max(500, 'Pagination cursors must be 500 characters or fewer.')
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'Pagination cursors must use URL-safe opaque values.',
  )

export const shoppingRunIdSchema = opaqueIdSchema

export function entityId(value: string): EntityId {
  return value as EntityId
}

export function isoDateTime(value: string | Date): IsoDateTime {
  return (value instanceof Date ? value.toISOString() : value) as IsoDateTime
}

export function decimalString(value: string | number): DecimalString {
  return String(value) as DecimalString
}
