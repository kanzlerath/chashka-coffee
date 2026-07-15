import { z } from 'zod'

export const mediaAssetSchema = z.object({ id: z.uuid(), objectKey: z.string().min(1).max(1024), publicUrl: z.url(), filename: z.string().min(1).max(255), contentType: z.string().min(1).max(120), byteSize: z.number().int().positive(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
export const createMediaUploadRequestSchema = z.object({ filename: z.string().trim().min(1).max(255), contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif']), byteSize: z.number().int().positive() }).strict()
export const mediaUploadResponseSchema = z.object({ asset: mediaAssetSchema, upload: z.object({ uploadUrl: z.url(), method: z.literal('PUT'), headers: z.record(z.string(), z.string()), contentLength: z.number().int().positive(), expiresAt: z.string().datetime() }) })
export const mediaAssetListResponseSchema = z.object({ assets: z.array(mediaAssetSchema) })
