import { mediaAssetDeleteResponseSchema, mediaAssetListResponseSchema, mediaAssetResponseSchema, mediaCardCropRequestSchema, mediaUploadResponseSchema } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { bodyLimit } from 'hono/body-limit'
import type { MiddlewareHandler } from 'hono'
import sharp from 'sharp'
import { z } from 'zod'

import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import { AppError, validationErrorHook } from '../../http/errors'
import { filenameWithExtension, isImageContentType, localMediaConfigFromEnv, LocalMediaStorage, thumbnailObjectKey, validateMediaUpload } from '../../storage/local-media'
import { createStorageObjectKey } from '../../storage/service'
import type { AuthHttpEnv } from '../auth'
import { imageCropBox } from './image-crop'
import { findMediaAssetReferences } from './references'

const asset = async (storage: LocalMediaStorage | null, value: { id: string; objectKey: string; publicUrl: string; filename: string; contentType: string; byteSize: number; status: 'PENDING' | 'READY'; createdAt: Date; updatedAt: Date }) => ({
  ...value,
  thumbnailUrl: storage && isImageContentType(value.contentType) && await storage.thumbnailExists(value.objectKey)
    ? `/uploads/${thumbnailObjectKey(value.objectKey)}`
    : null,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
})
export function createMediaModule({ db, env, requireAuth, requireAdmin }: { db: DbClient; env: AppEnv; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  const storageConfig = localMediaConfigFromEnv(env)
  const storage = storageConfig ? new LocalMediaStorage(storageConfig) : null
  routes.use('/media', requireAuth, requireAdmin)
  routes.use('/media/*', requireAuth, requireAdmin)
  const uploadMaxBytes = Math.max(env.MEDIA_UPLOAD_MAX_BYTES, env.MEDIA_VIDEO_UPLOAD_MAX_BYTES, env.MEDIA_DOCUMENT_UPLOAD_MAX_BYTES)
  routes.use('/media/uploads', bodyLimit({ maxSize: uploadMaxBytes, onError: (c) => c.json({ error: { code: 'VALIDATION_ERROR', message: 'Upload size is outside the allowed range', details: { maxBytes: uploadMaxBytes } } }, 400) }))
  const list = createRoute({ method: 'get', path: '/media', responses: { 200: { content: { 'application/json': { schema: mediaAssetListResponseSchema } }, description: 'Ready media assets' } } })
  const assetParams = z.object({ id: z.uuid() })
  const upload = createRoute({ method: 'post', path: '/media/uploads', responses: { 200: { content: { 'application/json': { schema: mediaUploadResponseSchema } }, description: 'Existing matching media asset' }, 201: { content: { 'application/json': { schema: mediaUploadResponseSchema } }, description: 'Saved public media upload' } } })
  const cropCardImage = createRoute({ method: 'post', path: '/media/{id}/card-crops', request: { params: assetParams, body: { content: { 'application/json': { schema: mediaCardCropRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: mediaAssetResponseSchema } }, description: 'Card-sized crop derived from an existing image' }, 400: { description: 'Asset is not an image' }, 404: { description: 'Media asset not found' }, 503: { description: 'Media storage is not configured' } } })
  const remove = createRoute({ method: 'delete', path: '/media/{id}', request: { params: assetParams }, responses: { 200: { content: { 'application/json': { schema: mediaAssetDeleteResponseSchema } }, description: 'Deleted media asset' }, 404: { description: 'Media asset not found' }, 409: { description: 'Media asset is in use' } } })
  routes.openapi(list, async (c) => {
    const assets = await db.mediaAsset.findMany({ where: { status: 'READY' }, orderBy: { createdAt: 'desc' } })
    return c.json({ assets: await Promise.all(assets.map((value) => asset(storage, value))) }, 200)
  })
  routes.openapi(upload, async (c) => {
    if (!storage) throw new AppError(503, 'INTERNAL_ERROR', 'Media storage is not configured')
    const file = (await c.req.parseBody()).file
    if (!(file instanceof File)) throw new AppError(400, 'VALIDATION_ERROR', 'Media file is required')

    const media = await validateMediaUpload(file, uploadMaxBytes)
    const maxBytes = media.contentType === 'video/mp4'
      ? env.MEDIA_VIDEO_UPLOAD_MAX_BYTES
      : media.contentType === 'application/pdf'
        ? env.MEDIA_DOCUMENT_UPLOAD_MAX_BYTES
        : storageConfig!.uploadMaxBytes
    if (file.size > maxBytes) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Upload size is outside the allowed range', { maxBytes })
    }
    const matchingAssets = await db.mediaAsset.findMany({
      where: { filename: { equals: file.name, mode: 'insensitive' }, contentType: media.contentType, byteSize: file.size, status: 'READY' },
      orderBy: { createdAt: 'desc' },
    })
    for (const matchingAsset of matchingAssets) {
      if (await storage.hasSameContents(matchingAsset.objectKey, file)) {
        await ensureThumbnail(storage, matchingAsset.objectKey, matchingAsset.contentType)
        return c.json({ asset: await asset(storage, matchingAsset), alreadyExists: true }, 200)
      }
    }
    const key = createStorageObjectKey({ namespace: 'media', filename: filenameWithExtension(file.name, media.extension) })

    await storage.write(key, file)
    try {
      const created = await db.mediaAsset.create({ data: { objectKey: key, publicUrl: `/uploads/${key}`, filename: file.name, contentType: media.contentType, byteSize: file.size, status: 'READY' } })
      await ensureThumbnail(storage, key, media.contentType)
      return c.json({ asset: await asset(storage, created), alreadyExists: false }, 201)
    } catch (error) {
      await storage.remove(key).catch(() => undefined)
      throw error
    }
  })
  routes.openapi(cropCardImage, async (c) => {
    if (!storage) throw new AppError(503, 'INTERNAL_ERROR', 'Media storage is not configured')
    const source = await db.mediaAsset.findUnique({ where: { id: c.req.valid('param').id } })
    if (!source) throw new AppError(404, 'NOT_FOUND', 'Файл не найден в медиатеке.')
    if (source.status !== 'READY') throw new AppError(409, 'CONFLICT', 'Файл ещё не готов к обработке.')
    if (!isImageContentType(source.contentType)) throw new AppError(400, 'VALIDATION_ERROR', 'Кадрировать можно только изображение.')

    const normalizedSource = await sharp(storage.destinationForKey(source.objectKey), { limitInputPixels: 40_000_000 }).rotate().toBuffer()
    const metadata = await sharp(normalizedSource).metadata()
    if (!metadata.width || !metadata.height) throw new AppError(400, 'VALIDATION_ERROR', 'Не удалось прочитать размеры изображения.')
    const crop = imageCropBox({ width: metadata.width, height: metadata.height, ...c.req.valid('json') })
    const output = await sharp(normalizedSource)
      .extract(crop)
      .resize({ width: 2_000, height: 2_000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer()
    if (output.byteLength > storageConfig!.uploadMaxBytes) throw new AppError(400, 'VALIDATION_ERROR', 'Получившийся кадр слишком большой. Уменьшите исходную фотографию.')
    const filename = filenameWithExtension(`${source.filename.replace(/\.[^.]+$/, '')}-card.webp`, 'webp')
    const key = createStorageObjectKey({ namespace: 'media', filename })
    const file = new File([output], filename, { type: 'image/webp' })

    await storage.write(key, file)
    try {
      const created = await db.mediaAsset.create({ data: { objectKey: key, publicUrl: `/uploads/${key}`, filename, contentType: 'image/webp', byteSize: file.size, status: 'READY' } })
      await ensureThumbnail(storage, key, created.contentType)
      return c.json({ asset: await asset(storage, created) }, 201)
    } catch (error) {
      await storage.remove(key).catch(() => undefined)
      throw error
    }
  })
  routes.openapi(remove, async (c) => {
    if (!storage) throw new AppError(503, 'INTERNAL_ERROR', 'Media storage is not configured')
    const mediaAsset = await db.mediaAsset.findUnique({ where: { id: c.req.valid('param').id } })
    if (!mediaAsset) throw new AppError(404, 'NOT_FOUND', 'Файл не найден в медиатеке.')

    const references = await findMediaAssetReferences(db, mediaAsset.publicUrl)
    if (references.length) {
      throw new AppError(409, 'CONFLICT', `Файл используется в разделе: ${references.join(', ')}. Сначала замените или уберите его там.`, { references })
    }

    await db.mediaAsset.delete({ where: { id: mediaAsset.id } })
    try {
      await storage.remove(mediaAsset.objectKey)
    } catch (error) {
      await db.mediaAsset.create({ data: mediaAsset }).catch(() => undefined)
      throw error
    }
    return c.json({ success: true as const }, 200)
  })
  return routes
}

async function ensureThumbnail(storage: LocalMediaStorage, objectKey: string, contentType: string) {
  if (!isImageContentType(contentType)) return

  try {
    await storage.createThumbnail(objectKey)
  } catch (error) {
    console.error(`Unable to create media thumbnail for ${objectKey}`, error)
  }
}
