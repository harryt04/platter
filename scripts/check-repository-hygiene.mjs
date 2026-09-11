import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)

const failures = []
const allowedEnvironmentTemplate = '.env.example'
const allowedBrandingRasterAssets = new Set([
  'app/apple-icon.png',
  'public/icons/platter-192.png',
  'public/icons/platter-512.png',
  'public/icons/platter-maskable-512.png',
])

const secretAssignmentPattern =
  /^[ \t]*(?:export[ \t]+)?[A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)[ \t]*[:=][ \t]*["']?(?!["']?(?:$|#|\$\(|\$\{|<))[A-Za-z0-9_./+=:@-]{16,}["']?[ \t]*$/gim
const secretMarkerPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(?:ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
]

for (const file of trackedFiles) {
  if (/^\.env(?:\..+)?$/.test(file) && file !== allowedEnvironmentTemplate) {
    failures.push(`tracked environment file: ${file}`)
  }

  const bytes = readFileSync(join(repositoryRoot, file))
  if (bytes.includes(0)) continue

  const contents = bytes.toString('utf8')
  if (secretAssignmentPattern.test(contents)) {
    failures.push(`credential-like assignment: ${file}`)
  }
  secretAssignmentPattern.lastIndex = 0

  for (const pattern of secretMarkerPatterns) {
    if (pattern.test(contents)) {
      failures.push(`secret marker: ${file}`)
      break
    }
  }
}

const rasterAssets = trackedFiles.filter((file) =>
  /\.(?:png|jpe?g|gif|webp)$/i.test(file),
)
for (const asset of rasterAssets) {
  if (!allowedBrandingRasterAssets.has(asset)) {
    failures.push(`unreviewed raster asset: ${asset}`)
  }
}

for (const policyFile of [
  'app/(legal)/privacy/page.tsx',
  'app/(legal)/terms/page.tsx',
]) {
  const contents = readFileSync(join(repositoryRoot, policyFile), 'utf8')
  if (!/Hosted operators must complete[\s\S]+before launch/i.test(contents)) {
    failures.push(`operator policy is not marked as a template: ${policyFile}`)
  }
}

if (failures.length > 0) {
  console.error('Repository hygiene check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(
    `Repository hygiene check passed for ${trackedFiles.length} tracked files; no credential markers, unreviewed raster assets, or unmarked policy templates found.`,
  )
}
