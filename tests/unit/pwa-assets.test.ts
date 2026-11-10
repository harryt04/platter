import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readPngDimensions(path: string) {
  const data = readFileSync(join(root, path))
  expect(data.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  )
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

describe('PWA icon assets', () => {
  it('publishes the required install icon sizes and maskable variant', () => {
    expect(readPngDimensions('public/icons/platter-192.png')).toEqual({
      width: 192,
      height: 192,
    })
    expect(readPngDimensions('public/icons/platter-512.png')).toEqual({
      width: 512,
      height: 512,
    })
    expect(readPngDimensions('public/icons/platter-maskable-512.png')).toEqual({
      width: 512,
      height: 512,
    })
    expect(readPngDimensions('app/apple-icon.png')).toEqual({
      width: 180,
      height: 180,
    })
  })

  it('declares separate any and maskable icons in the web manifest', () => {
    const manifest = JSON.parse(
      readFileSync(join(root, 'app/manifest.webmanifest'), 'utf8'),
    ) as { icons: { src: string; purpose: string }[] }

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icons/platter-192.png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icons/platter-512.png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icons/platter-maskable-512.png',
          purpose: 'maskable',
        }),
      ]),
    )
  })
})
