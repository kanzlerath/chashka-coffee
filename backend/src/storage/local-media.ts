import { mkdir, rm } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

import type { AppEnv } from '../env'
import { AppError } from '../http/errors'
import { assertSafeObjectKey } from './service'

const imageTypes = {
  'image/jpeg': { extension: 'jpg', matches: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', matches: (bytes: Uint8Array) => bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]) },
  'image/webp': { extension: 'webp', matches: (bytes: Uint8Array) => readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP' },
  'image/avif': { extension: 'avif', matches: (bytes: Uint8Array) => readAscii(bytes, 4, 4) === 'ftyp' && ['avif', 'avis'].some((brand) => readAscii(bytes, 8, 4) === brand || containsAscii(bytes, brand)) },
} as const

const videoTypes = {
  'video/mp4': {
    extension: 'mp4',
    matches: (bytes: Uint8Array) => readAscii(bytes, 4, 4) === 'ftyp' && mp4Brands.some((brand) => readAscii(bytes, 8, 4) === brand || containsAscii(bytes, brand)),
  },
} as const

const documentTypes = {
  'application/pdf': {
    extension: 'pdf',
    matches: (bytes: Uint8Array) => readAscii(bytes, 0, 5) === '%PDF-',
  },
} as const

const mediaTypes = { ...imageTypes, ...videoTypes, ...documentTypes }
const mp4Brands = ['isom', 'iso2', 'iso5', 'iso6', 'avc1', 'mp41', 'mp42', 'mp4v', 'M4V ', 'dash']

export type LocalMediaConfig = {
  uploadsDir: string
  uploadMaxBytes: number
}

export type ValidatedImageUpload = {
  contentType: keyof typeof imageTypes
  extension: string
}

export type ValidatedMediaUpload = {
  contentType: keyof typeof mediaTypes
  extension: string
}

export class LocalMediaStorage {
  private readonly rootDirectory: string

  constructor(config: LocalMediaConfig) {
    if (!isAbsolute(config.uploadsDir)) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Media uploads directory must be absolute')
    }

    this.rootDirectory = resolve(config.uploadsDir)
  }

  async write(key: string, file: File) {
    const destination = this.destinationForKey(key)
    await mkdir(dirname(destination), { recursive: true })
    await Bun.write(destination, file)
  }

  async remove(key: string) {
    await rm(this.destinationForKey(key), { force: true })
  }

  async hasSameContents(key: string, file: File) {
    const existing = Bun.file(this.destinationForKey(key))
    if (!(await existing.exists()) || existing.size !== file.size) return false

    const [existingHash, fileHash] = await Promise.all([
      sha256(await existing.arrayBuffer()),
      sha256(await file.arrayBuffer()),
    ])
    return existingHash === fileHash
  }

  destinationForKey(key: string) {
    const safeKey = assertSafeObjectKey(key)
    const destination = resolve(this.rootDirectory, safeKey)
    const pathFromRoot = relative(this.rootDirectory, destination)

    if (pathFromRoot === '' || pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Storage object key is outside the media directory')
    }

    return destination
  }
}

export function localMediaConfigFromEnv(env: AppEnv): LocalMediaConfig | null {
  if (!env.MEDIA_UPLOADS_DIR) return null

  return {
    uploadsDir: env.MEDIA_UPLOADS_DIR,
    uploadMaxBytes: env.MEDIA_UPLOAD_MAX_BYTES,
  }
}

export async function validateMediaUpload(file: File, maxBytes: number): Promise<ValidatedMediaUpload> {
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > maxBytes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Upload size is outside the allowed range', { maxBytes })
  }

  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const contentType = (Object.entries(mediaTypes) as Array<[keyof typeof mediaTypes, (typeof mediaTypes)[keyof typeof mediaTypes]]>)
    .find(([, type]) => type.matches(bytes))?.[0]

  if (!contentType) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Uploaded file is not a supported image or video')
  }

  return {
    contentType,
    extension: mediaTypes[contentType].extension,
  }
}

export async function validateImageUpload(file: File, maxBytes: number): Promise<ValidatedImageUpload> {
  const media = await validateMediaUpload(file, maxBytes)
  if (!(media.contentType in imageTypes)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Uploaded file is not a supported image')
  }

  return { contentType: media.contentType as keyof typeof imageTypes, extension: media.extension }
}

export function filenameWithExtension(filename: string, extension: string) {
  const baseName = filename.trim().replace(/\.[^.]*$/, '') || 'image'
  return `${baseName}.${extension}`
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  if (bytes.length < offset + length) return ''
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function containsAscii(bytes: Uint8Array, value: string) {
  const haystack = String.fromCharCode(...bytes)
  return haystack.includes(value)
}

async function sha256(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', value)
  return Buffer.from(digest).toString('hex')
}
