import type { Db } from 'mongodb'
import { MongoRecipeSearchProvider } from './mongo-provider'
import type { SearchProvider } from './provider'

/**
 * Return the built-in search implementation used when no hosted search
 * integration is configured. Keeping this decision in one place preserves a
 * replaceable boundary without making core discovery depend on a paid or
 * proprietary service.
 */
export function createRecipeSearchProvider(db: Db): SearchProvider {
  return new MongoRecipeSearchProvider(db)
}
