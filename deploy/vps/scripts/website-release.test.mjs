import { mkdtemp, readlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

import { publishWebsiteRelease } from './website-release.mjs'

describe('website release publishing', () => {
  test('keeps the current release live until the next build succeeds', async () => {
    const releasesDir = await mkdtemp(join(tmpdir(), 'chashka-website-release-'))
    const build = async (outDir) => writeFile(join(outDir, 'index.html'), '<h1>ok</h1>')

    const first = await publishWebsiteRelease({ releasesDir, build, releaseName: 'release-1' })
    expect(await readlink(join(releasesDir, 'current'))).toBe('release-1')

    await expect(publishWebsiteRelease({
      releasesDir,
      releaseName: 'release-2',
      build: async () => { throw new Error('Astro build failed') },
    })).rejects.toThrow('Astro build failed')

    expect(await readlink(join(releasesDir, 'current'))).toBe('release-1')
    expect(first).toBe(join(releasesDir, 'release-1'))
  })
})
