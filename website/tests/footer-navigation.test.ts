import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { CATERING_URL, footerGroups, footerLegalLinks } from '../src/lib/footer-navigation'

const expectedSectionRoutes = [
  '/about',
  '/app',
  '/bakery',
  '/banquets',
  '/certificates',
  '/coffee',
  '/contacts',
  '/corporate',
  '/delivery',
  '/events',
  '/franchise',
  '/jobs',
  '/journal',
  '/loyalty',
  '/menu',
  '/promotions',
  '/restaurants',
]

const expectedLegalRoutes = [
  '/certificate-rules',
  '/consent',
  '/loyalty-rules',
  '/privacy',
  '/promotion-rules',
  '/terms',
]

describe('footer navigation', () => {
  test('covers every published top-level section and legal document', () => {
    const sectionRoutes = footerGroups.flatMap((group) => group.links)
      .filter((link) => link.href.startsWith('/'))
      .map((link) => link.href)
      .sort()
    const legalRoutes = footerLegalLinks.map((link) => link.href).sort()

    expect(sectionRoutes).toEqual(expectedSectionRoutes)
    expect(legalRoutes).toEqual(expectedLegalRoutes)
  })

  test('keeps every internal footer link backed by a real Astro page', () => {
    const pagesDirectory = fileURLToPath(new URL('../src/pages/', import.meta.url))
    const internalLinks = [
      ...footerGroups.flatMap((group) => group.links).filter((link) => !link.external),
      ...footerLegalLinks,
    ].filter((link) => link.href.startsWith('/'))

    for (const link of internalLinks) {
      expect(existsSync(`${pagesDirectory}${link.href.slice(1)}.astro`)).toBeTrue()
    }
  })

  test('uses the same catering destination as the site navigation', () => {
    const catering = footerGroups.flatMap((group) => group.links).find((link) => link.label === 'Кейтеринг')

    expect(catering).toEqual({
      label: 'Кейтеринг',
      href: CATERING_URL,
      external: true,
    })
  })
})
