import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { legalDocuments } from '../src/lib/legal-documents'

const expectedRoutes = [
  '/advertising-consent',
  '/certificate-rules',
  '/consent',
  '/cookies',
  '/data-request',
  '/loyalty-rules',
  '/offer',
  '/privacy',
  '/promotion-rules',
  '/requisites',
  '/terms',
]

describe('legal document registry', () => {
  test('keeps one current, uniquely ordered index of every public document', () => {
    expect(legalDocuments.map((document) => document.href).sort()).toEqual(expectedRoutes)
    expect(new Set(legalDocuments.map((document) => document.number)).size).toBe(legalDocuments.length)
    expect(legalDocuments.every((document) => document.effectiveDate === '11 августа 2026')).toBeTrue()
  })

  test('backs every indexed document with a real Astro route', () => {
    const pagesDirectory = fileURLToPath(new URL('../src/pages/', import.meta.url))
    for (const document of legalDocuments) {
      expect(existsSync(`${pagesDirectory}${document.href}.astro`)).toBeTrue()
    }
  })
})
