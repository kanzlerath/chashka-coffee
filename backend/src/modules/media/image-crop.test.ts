import { describe, expect, test } from 'bun:test'

import { imageCropBox } from './image-crop'

describe('imageCropBox', () => {
  test('uses the full image when it already matches the card ratio', () => {
    expect(imageCropBox({ width: 1_000, height: 860, focusX: 50, focusY: 50, zoom: 1 })).toEqual({ left: 0, top: 0, width: 1_000, height: 860 })
  })

  test('moves a landscape crop to the selected horizontal focus', () => {
    expect(imageCropBox({ width: 2_000, height: 1_000, focusX: 100, focusY: 50, zoom: 1 })).toEqual({ left: 837, top: 0, width: 1_163, height: 1_000 })
  })

  test('zooms around the selected focus without exceeding the source image', () => {
    expect(imageCropBox({ width: 2_000, height: 1_000, focusX: 50, focusY: 50, zoom: 2 })).toEqual({ left: 709, top: 250, width: 581, height: 500 })
  })
})
