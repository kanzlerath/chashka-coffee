import {
  mediaUploadResponseSchema,
} from '@chashka-coffee/contracts'

import type { AuthContextValue } from '@/features/auth'

export const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const publicSiteOrigin = (import.meta.env.VITE_PUBLIC_SITE_URL ?? 'http://localhost:4321').replace(/\/$/, '')

export const resolveAdminImagePreview = (url: string) => url.startsWith('/') ? `${publicSiteOrigin}${url}` : url

export async function uploadMediaFile(api: AuthContextValue['api'], file: File) {
  if (!supportedTypes.has(file.type)) throw new Error('Поддерживаются JPEG, PNG, WebP и AVIF.')
  const formData = new FormData()
  formData.set('file', file)
  return api.request('/api/admin/media/uploads', mediaUploadResponseSchema, { method: 'POST', body: formData })
}
