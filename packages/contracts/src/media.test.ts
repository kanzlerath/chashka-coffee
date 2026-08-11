import { describe, expect, test } from 'bun:test'

import { mediaCardCropRequestSchema } from './media'

describe('mediaCardCropRequestSchema', () => {
  test('accepts a card crop within the editor limits', () => {
    expect(mediaCardCropRequestSchema.parse({ focusX: 75, focusY: 25, zoom: 1.4 })).toEqual({ focusX: 75, focusY: 25, zoom: 1.4 })
  })

  test('rejects crop values outside the editor limits', () => {
    expect(mediaCardCropRequestSchema.safeParse({ focusX: 101, focusY: 25, zoom: 1.4 }).success).toBe(false)
    expect(mediaCardCropRequestSchema.safeParse({ focusX: 75, focusY: 25, zoom: 2.1 }).success).toBe(false)
  })
})
