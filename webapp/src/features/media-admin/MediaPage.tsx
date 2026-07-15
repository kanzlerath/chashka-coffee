import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMediaUploadRequestSchema, mediaAssetListResponseSchema, mediaAssetResponseSchema, mediaUploadResponseSchema } from '@chashka-coffee/contracts'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
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

  return <section className="mx-auto grid w-full max-w-6xl gap-7 px-5 py-9">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5"><div><h1 className="text-2xl font-semibold tracking-tight">Медиатека</h1><p className="mt-1 text-sm text-muted-foreground">Загрузите изображение один раз и вставляйте его ссылку в кофейни, блюда и материалы.</p></div><div className="flex items-center gap-3"><Input ref={inputRef} accept="image/jpeg,image/png,image/webp,image/avif" className="max-w-64" disabled={upload.isPending} type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file) }} /><Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>{upload.isPending ? 'Загрузка…' : 'Выбрать файл'}</Button></div></header>
    <p className="text-xs text-muted-foreground">JPEG, PNG, WebP или AVIF. Файл попадает в медиатеку только после проверки хранилища.</p>
    {upload.isError && <p className="text-sm text-destructive">{upload.error instanceof Error ? upload.error.message : 'Не удалось загрузить изображение.'}</p>}
    {assets.isPending && <p className="text-sm text-muted-foreground">Загружаем медиатеку…</p>}
    {assets.isError && <p className="text-sm text-destructive">Не удалось загрузить медиатеку.</p>}
    {!assets.isPending && !assets.isError && assets.data?.assets.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Здесь появятся подтверждённые изображения.</p>}
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-4">{assets.data?.assets.map((asset) => <figure key={asset.id} className="group bg-background"><img src={asset.publicUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" /><figcaption className="grid gap-1 p-3"><p className="truncate text-sm font-medium">{asset.filename}</p><button className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline" type="button" onClick={() => void navigator.clipboard.writeText(asset.publicUrl)}>Скопировать ссылку</button></figcaption></figure>)}</div>
  </section>
}
