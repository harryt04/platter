import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const loaderPath = join(process.cwd(), 'scripts/load-env.mjs')

function loadEnvironment(overrides: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'platter-env-'))

  try {
    writeFileSync(
      join(directory, '.env'),
      'MONGODB_URI=mongodb://base.example:27017\nMONGODB_DATABASE=base\n',
    )
    writeFileSync(
      join(directory, '.env.local'),
      'MONGODB_URI=mongodb://local.example:27017\nMONGODB_DATABASE=local\n',
    )

    const environment = { ...process.env }
    delete environment.MONGODB_URI
    delete environment.MONGODB_DATABASE
    Object.assign(environment, overrides)

    return JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--import',
          loaderPath,
          '-e',
          'console.log(JSON.stringify({ uri: process.env.MONGODB_URI, database: process.env.MONGODB_DATABASE }))',
        ],
        { cwd: directory, env: environment, encoding: 'utf8' },
      ),
    ) as { uri: string; database: string }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('standalone environment loader', () => {
  it('gives .env.local precedence over .env', () => {
    expect(loadEnvironment()).toEqual({
      uri: 'mongodb://local.example:27017',
      database: 'local',
    })
  })

  it('preserves explicitly exported environment variables', () => {
    expect(
      loadEnvironment({
        MONGODB_URI: 'mongodb://shell.example:27017',
        MONGODB_DATABASE: 'shell',
      }),
    ).toEqual({
      uri: 'mongodb://shell.example:27017',
      database: 'shell',
    })
  })
})
