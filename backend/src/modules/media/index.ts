import { mediaAssetListResponseSchema, mediaUploadResponseSchema } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { bodyLimit } from 'hono/body-limit'
import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import { AppError, validationErrorHook } from '../../http/errors'
import { filenameWithExtension, localMediaConfigFromEnv, LocalMediaStorage, validateImageUpload } from '../../storage/local-media'
import { createStorageObjectKey } from '../../storage/service'
import type { AuthHttpEnv } from '../auth'

const asset = (value: { id: string; objectKey: string; publicUrl: string; filename: string; contentType: string; byteSize: number; status: 'PENDING' | 'READY'; createdAt: Date; updatedAt: Date }) => ({ ...value, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() })
export function createMediaModule({ db, env, requireAuth, requireAdmin }: { db: DbClient; env: AppEnv; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  const storageConfig = localMediaConfigFromEnv(env)
  const storage = storageConfig ? new LocalMediaStorage(storageConfig) : null
  routes.use('/media', requireAuth, requireAdmin)
  routes.use('/media/*', requireAuth, requireAdmin)
  routes.use('/media/uploads', bodyLimit({ maxSize: env.MEDIA_UPLOAD_MAX_BYTES, onError: (c) => c.json({ error: { code: 'VALIDATION_ERROR', message: 'Upload size is outside the allowed range', details: { maxBytes: env.MEDIA_UPLOAD_MAX_BYTES } } }, 400) }))
  const list = createRoute({ method: 'get', path: '/media', responses: { 200: { content: { 'application/json': { schema: mediaAssetListResponseSchema } }, description: 'Ready media assets' } } })
  const upload = createRoute({ method: 'post', path: '/media/uploads', responses: { 201: { content: { 'application/json': { schema: mediaUploadResponseSchema } }, description: 'Saved public image upload' } } })
  routes.openapi(list, async (c) => c.json({ assets: (await db.mediaAsset.findMany({ where: { status: 'READY' }, orderBy: { createdAt: 'desc' } })).map(asset) }, 200))
  routes.openapi(upload, async (c) => {
    if (!storage) throw new AppError(503, 'INTERNAL_ERROR', 'Media storage is not configured')
    const file = (await c.req.parseBody()).file
    if (!(file instanceof File)) throw new AppError(400, 'VALIDATION_ERROR', 'Image file is required')

    const image = await validateImageUpload(file, storageConfig!.uploadMaxBytes)
    const key = createStorageObjectKey({ namespace: 'media', filename: filenameWithExtension(file.name, image.extension) })

    await storage.write(key, file)
    try {
      const created = await db.mediaAsset.create({ data: { objectKey: key, publicUrl: `/uploads/${key}`, filename: file.name, contentType: image.contentType, byteSize: file.size, status: 'READY' } })
      return c.json({ asset: asset(created) }, 201)
    } catch (error) {
      await storage.remove(key).catch(() => undefined)
      throw error
    }
  })
  return routes
}
