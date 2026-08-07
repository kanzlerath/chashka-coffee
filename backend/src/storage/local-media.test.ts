import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'

import { AppError } from '../http/errors'
import { filenameWithExtension, LocalMediaStorage, validateImageUpload } from './local-media'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('LocalMediaStorage', () => {
  test('writes an image below its configured root', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chashka-media-'))
    temporaryDirectories.push(directory)
    const storage = new LocalMediaStorage({ uploadsDir: directory, uploadMaxBytes: 1024 })
    const image = new File([pngBytes], 'coffee.png', { type: 'image/png' })

    await storage.write('media/2026/08/coffee.png', image)

    expect(await readFile(storage.destinationForKey('media/2026/08/coffee.png'))).toEqual(Buffer.from(pngBytes))
    expect(() => storage.destinationForKey('../outside.png')).toThrow(AppError)
  })

  test('accepts supported image signatures and forces the detected extension', async () => {
    await expect(validateImageUpload(new File([pngBytes], 'coffee.jpg', { type: 'image/png' }), 1024)).resolves.toEqual({ contentType: 'image/png', extension: 'png' })
    expect(filenameWithExtension('coffee.jpg', 'png')).toBe('coffee.png')
  })

  test('uses the detected format and rejects oversized or non-image uploads', async () => {
    await expect(validateImageUpload(new File([pngBytes], 'coffee.jpg', { type: 'image/jpeg' }), 1024)).resolves.toEqual({ contentType: 'image/png', extension: 'png' })
    await expect(validateImageUpload(new File([new Uint8Array(1025)], 'large.png', { type: 'image/png' }), 1024)).rejects.toThrow('outside the allowed range')
    await expect(validateImageUpload(new File([new TextEncoder().encode('not an image')], 'coffee.png', { type: 'image/png' }), 1024)).rejects.toThrow('not a supported image')
  })
})

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
