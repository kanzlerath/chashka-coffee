import { describe, expect, test } from 'bun:test'

import { cardImageCropSchema } from './media'

describe('cardImageCropSchema', () => {
  test('accepts a card crop within the editor limits', () => {
    expect(cardImageCropSchema.parse({ focusX: 75, focusY: 25, zoom: 1.4 })).toEqual({ focusX: 75, focusY: 25, zoom: 1.4 })
  })

  test('rejects crop values outside the editor limits', () => {
    expect(cardImageCropSchema.safeParse({ focusX: 101, focusY: 25, zoom: 1.4 }).success).toBe(false)
    expect(cardImageCropSchema.safeParse({ focusX: 75, focusY: 25, zoom: 2.1 }).success).toBe(false)
  })
})
