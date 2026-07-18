import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMediaUploadRequestSchema, mediaAssetListResponseSchema, mediaAssetResponseSchema, mediaUploadResponseSchema } from '@chashka-coffee/contracts'
import { useRef } from 'react'

import { AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth'

const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export function MediaPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const assets = useQuery({ queryKey: ['admin', 'media'], queryFn: () => api.request('/api/admin/media', mediaAssetListResponseSchema) })
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!supportedTypes.has(file.type)) throw new Error('Неподдерживаемый формат')
      const request = createMediaUploadRequestSchema.parse({ filename: file.name, contentType: file.type, byteSize: file.size })
      const { asset, upload } = await api.request('/api/admin/media/uploads', mediaUploadResponseSchema, { method: 'POST', body: request })
      const response = await fetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body: file })
      if (!response.ok) throw new Error('Не удалось загрузить файл в хранилище')
      return api.request(`/api/admin/media/${asset.id}/confirm`, mediaAssetResponseSchema, { method: 'POST' })
    },
    onSuccess: () => { if (inputRef.current) inputRef.current.value = ''; void queryClient.invalidateQueries({ queryKey: ['admin', 'media'] }) },
  })

  return <section className="admin-page">
    <AdminPageHeader eyebrow="Публикация" title="Медиатека" description="Загружайте изображения один раз и используйте их в ресторанах, блюдах и материалах." actions={<><Input ref={inputRef} accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={upload.isPending} type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file) }} /><Button type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>{upload.isPending ? 'Загружаем…' : 'Загрузить файл'}</Button></>} />
    <p className="text-xs text-muted-foreground">JPEG, PNG, WebP или AVIF. Файл появляется здесь только после подтверждения хранилищем.</p>
    {upload.isError && <p className="text-sm text-destructive">{upload.error instanceof Error ? upload.error.message : 'Не удалось загрузить изображение.'}</p>}
    {assets.isPending && <p className="text-sm text-muted-foreground">Загружаем медиатеку…</p>}
    {assets.isError && <p className="text-sm text-destructive">Не удалось загрузить медиатеку.</p>}
    {!assets.isPending && !assets.isError && assets.data?.assets.length === 0 && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Здесь появятся подтверждённые изображения.</CardContent></Card>}
    <div className="admin-media-grid">{assets.data?.assets.map((asset) => <figure key={asset.id} className="admin-media-tile"><img src={asset.publicUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" /><figcaption><p title={asset.filename}>{asset.filename}</p><button type="button" onClick={() => void navigator.clipboard.writeText(asset.publicUrl)}>Скопировать ссылку</button></figcaption></figure>)}</div>
  </section>
}
