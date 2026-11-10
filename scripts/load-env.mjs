import { loadEnvFile } from 'node:process'

for (const file of ['.env.local', '.env']) {
  try {
    loadEnvFile(file)
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error
    }
  }
}
