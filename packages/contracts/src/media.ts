import { z } from 'zod'

export const mediaAssetStatusSchema = z.enum(['PENDING', 'READY'])
const mediaPublicUrlSchema = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path')
export const mediaAssetSchema = z.object({ id: z.uuid(), objectKey: z.string().min(1).max(1024), publicUrl: mediaPublicUrlSchema, thumbnailUrl: mediaPublicUrlSchema.nullable(), filename: z.string().min(1).max(255), contentType: z.string().min(1).max(120), byteSize: z.number().int().positive(), status: mediaAssetStatusSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
export type MediaAsset = z.infer<typeof mediaAssetSchema>
export const mediaUploadResponseSchema = z.object({ asset: mediaAssetSchema, alreadyExists: z.boolean() })
export const mediaAssetListResponseSchema = z.object({ assets: z.array(mediaAssetSchema) })
export const mediaAssetResponseSchema = z.object({ asset: mediaAssetSchema })
export const mediaAssetDeleteResponseSchema = z.object({ success: z.literal(true) })
export const mediaCardCropRequestSchema = z.object({
  focusX: z.number().min(0).max(100),
  focusY: z.number().min(0).max(100),
  zoom: z.number().min(1).max(2),
}).strict()
export type MediaCardCropRequest = z.infer<typeof mediaCardCropRequestSchema>
