import {
  mediaAssetDeleteResponseSchema,
  mediaUploadResponseSchema,
} from '@chashka-coffee/contracts'

import type { AuthContextValue } from '@/features/auth'

export const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
export const supportedVideoTypes = new Set(['video/mp4'])
export const supportedDocumentTypes = new Set(['application/pdf'])
export const supportedMediaTypes = new Set([...supportedImageTypes, ...supportedVideoTypes, ...supportedDocumentTypes])
const publicSiteOrigin = (import.meta.env.VITE_PUBLIC_SITE_URL ?? 'http://localhost:4321').replace(/\/$/, '')

export const resolveAdminImagePreview = (url: string) => url.startsWith('/') ? `${publicSiteOrigin}${url}` : url
export const isVideoMedia = (contentType: string) => supportedVideoTypes.has(contentType)
export const isDocumentMedia = (contentType: string) => supportedDocumentTypes.has(contentType)

export async function uploadMediaFile(api: AuthContextValue['api'], file: File) {
  if (!supportedMediaTypes.has(file.type)) throw new Error('Поддерживаются JPEG, PNG, WebP, AVIF, MP4 и PDF.')
  const formData = new FormData()
  formData.set('file', file)
  return api.request('/api/admin/media/uploads', mediaUploadResponseSchema, { method: 'POST', body: formData })
}

export function deleteMediaFile(api: AuthContextValue['api'], id: string) {
  return api.request(`/api/admin/media/${id}`, mediaAssetDeleteResponseSchema, { method: 'DELETE' })
}
