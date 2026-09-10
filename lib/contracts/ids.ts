export type EntityId = string & { readonly __brand: 'EntityId' }
export type IsoDateTime = string & { readonly __brand: 'IsoDateTime' }
export type DecimalString = string & { readonly __brand: 'DecimalString' }

export function entityId(value: string): EntityId {
  return value as EntityId
}

export function isoDateTime(value: string | Date): IsoDateTime {
  return (value instanceof Date ? value.toISOString() : value) as IsoDateTime
}

export function decimalString(value: string | number): DecimalString {
  return String(value) as DecimalString
}
