import { createMediaUploadRequestSchema, mediaAssetListResponseSchema, mediaAssetResponseSchema, mediaUploadResponseSchema } from '@chashka-coffee/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import { AppError, validationErrorHook } from '../../http/errors'
import { createStorageObjectKey, createStorageServiceFromEnv } from '../../storage/service'
import type { AuthHttpEnv } from '../auth'

const asset = (value: { id: string; objectKey: string; publicUrl: string; filename: string; contentType: string; byteSize: number; status: 'PENDING' | 'READY'; createdAt: Date; updatedAt: Date }) => ({ ...value, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() })
const idParams = z.object({ id: z.uuid() })
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

export function createMediaModule({ db, env, requireAuth, requireAdmin }: { db: DbClient; env: AppEnv; requireAuth: MiddlewareHandler<AuthHttpEnv>; requireAdmin: MiddlewareHandler<AuthHttpEnv> }) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth, requireAdmin)
  const list = createRoute({ method: 'get', path: '/media', responses: { 200: { content: { 'application/json': { schema: mediaAssetListResponseSchema } }, description: 'Ready media assets' } } })
  const upload = createRoute({ method: 'post', path: '/media/uploads', request: { body: { content: { 'application/json': { schema: createMediaUploadRequestSchema } } } }, responses: { 201: { content: { 'application/json': { schema: mediaUploadResponseSchema } }, description: 'Presigned public image upload' } } })
  const confirm = createRoute({ method: 'post', path: '/media/{id}/confirm', request: { params: idParams }, responses: { 200: { content: { 'application/json': { schema: mediaAssetResponseSchema } }, description: 'Media asset confirmed' }, 404: { content: { 'application/json': { schema: errorSchema } }, description: 'Media asset not found' } } })
  routes.openapi(list, async (c) => c.json({ assets: (await db.mediaAsset.findMany({ where: { status: 'READY' }, orderBy: { createdAt: 'desc' } })).map(asset) }, 200))
  routes.openapi(upload, async (c) => {
    const storage = createStorageServiceFromEnv(env)
    if (!storage) throw new AppError(503, 'INTERNAL_ERROR', 'Media storage is not configured')
    const input = c.req.valid('json')
    const key = createStorageObjectKey({ namespace: 'media', filename: input.filename })
    const signed = await storage.createUploadUrl({ key, contentType: input.contentType, byteSize: input.byteSize, visibility: 'public' })
    const created = await db.mediaAsset.create({ data: { objectKey: signed.key, publicUrl: signed.publicUrl!, filename: input.filename, contentType: input.contentType, byteSize: input.byteSize, status: 'PENDING' } })
    return c.json({ asset: asset(created), upload: { uploadUrl: signed.uploadUrl, method: signed.method, headers: signed.headers, contentLength: signed.contentLength, expiresAt: signed.expiresAt } }, 201)
  })
  routes.openapi(confirm, async (c) => {
    const storage = createStorageServiceFromEnv(env)
    if (!storage) throw new AppError(503, 'INTERNAL_ERROR', 'Media storage is not configured')
    const pending = await db.mediaAsset.findUnique({ where: { id: c.req.valid('param').id } })
    if (!pending) throw new AppError(404, 'NOT_FOUND', 'Media asset not found')
    await storage.assertPublicObject({ key: pending.objectKey, contentType: pending.contentType, byteSize: pending.byteSize })
    const confirmed = pending.status === 'READY' ? pending : await db.mediaAsset.update({ where: { id: pending.id }, data: { status: 'READY' } })
    return c.json({ asset: asset(confirmed) }, 200)
  })
  return routes
}
