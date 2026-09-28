import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generateSeoFiles } from './generate-seo.mjs'

test('production sitemap uses canonical URLs and excludes private pages', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'chashka-seo-'))
  try {
    await mkdir(join(outDir, 'restaurants'))
    await mkdir(join(outDir, 'account'))
    await writeFile(join(outDir, 'index.html'), '<link rel="canonical" href="https://chashkacoffee.ru/">')
    await writeFile(join(outDir, 'restaurants/index.html'), '<link rel="canonical" href="https://chashkacoffee.ru/restaurants">')
    await writeFile(join(outDir, 'account/index.html'), '<link rel="canonical" href="https://chashkacoffee.ru/account"><meta name="robots" content="noindex,nofollow">')

    expect(await generateSeoFiles({ outDir, siteUrl: 'https://chashkacoffee.ru' })).toBe(2)
    const sitemap = await readFile(join(outDir, 'sitemap.xml'), 'utf8')
    expect(sitemap).toContain('https://chashkacoffee.ru/restaurants')
    expect(sitemap).not.toContain('/account')
    expect(await readFile(join(outDir, 'robots.txt'), 'utf8')).toContain('Allow: /')
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})

test('DEV robots file disallows indexing', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'chashka-seo-dev-'))
  try {
    await writeFile(join(outDir, 'index.html'), '<link rel="canonical" href="https://dev.chashkacoffee.ru/">')
    await generateSeoFiles({ outDir, siteUrl: 'https://dev.chashkacoffee.ru', disallowIndexing: true })
    expect(await readFile(join(outDir, 'robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n')
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})
