import { SearchIcon, Upload01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { mediaAssetListResponseSchema } from '@chashka-coffee/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'

import { AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Typography } from '@/components/ui/typography'
import { useAuth } from '@/features/auth'

import { isDocumentMedia, isVideoMedia, resolveAdminImagePreview, supportedMediaTypes, uploadMediaFile } from './media-utils'

const formatBytes = (value: number) => value >= 1_048_576 ? `${(value / 1_048_576).toFixed(1)} МБ` : `${Math.max(1, Math.round(value / 1_024))} КБ`
const formatDate = (value: string) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))

export function MediaPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'ALL' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'video/mp4' | 'application/pdf'>('ALL')
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const assets = useQuery({ queryKey: ['admin', 'media'], queryFn: () => api.request('/api/admin/media', mediaAssetListResponseSchema) })
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru')
    return assets.data?.assets.filter((asset) => (type === 'ALL' || asset.contentType === type) && (!normalized || asset.filename.toLocaleLowerCase('ru').includes(normalized))) ?? []
  }, [assets.data, query, type])

  const uploadFiles = async (files: File[]) => {
    const supported = files.filter((file) => supportedMediaTypes.has(file.type))
    setUploadError(supported.length === files.length ? null : 'Некоторые файлы пропущены: поддерживаются JPEG, PNG, WebP, AVIF, MP4 и PDF.')
    if (!supported.length) return
    setUploading({ done: 0, total: supported.length })
    try {
      for (let index = 0; index < supported.length; index += 1) {
        await uploadMediaFile(api, supported[index])
        setUploading({ done: index + 1, total: supported.length })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Не удалось загрузить медиафайлы.')
    } finally {
      setUploading(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return <section className="admin-page admin-media-page">
    <AdminPageHeader eyebrow="Медиа" title="Медиатека" description="Фотографии, MP4-видео и PDF для сайта. Из редакторов их можно выбирать повторно; для первого экрана добавляйте отдельный постер." actions={<><Input ref={inputRef} accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,application/pdf" className="sr-only" disabled={Boolean(uploading)} multiple type="file" onChange={(event) => void uploadFiles([...event.target.files ?? []])} /><Button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(uploading)}><HugeiconsIcon icon={Upload01Icon} size={17} strokeWidth={1.8} />{uploading ? `${uploading.done} из ${uploading.total}` : 'Загрузить медиа'}</Button></>} />

    <div className="admin-media-toolbar">
      <InputGroup><InputGroupAddon align="inline-start"><HugeiconsIcon icon={SearchIcon} size={17} strokeWidth={1.8} /></InputGroupAddon><InputGroupInput aria-label="Поиск по медиатеке" placeholder="Название файла…" value={query} onChange={(event) => setQuery(event.target.value)} /></InputGroup>
      <select aria-label="Формат файла" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="ALL">Все форматы</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option><option value="image/avif">AVIF</option><option value="video/mp4">MP4-видео</option><option value="application/pdf">PDF</option></select>
      <Typography variant="bodySm" tone="muted">{visible.length} из {assets.data?.assets.length ?? 0}</Typography>
    </div>

    {uploadError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">{uploadError}</Typography> : null}
    {assets.isPending ? <Typography className="admin-state-message" variant="bodySm">Загружаем медиатеку…</Typography> : null}
    {assets.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось загрузить медиатеку.</Typography> : null}
    {!assets.isPending && !assets.isError && visible.length === 0 ? <div className="admin-media-empty"><Typography variant="bodySmMedium">{assets.data?.assets.length ? 'Файлы не найдены' : 'Медиатека пока пуста'}</Typography><Typography variant="bodySm" tone="muted">{assets.data?.assets.length ? 'Измените поиск или фильтр формата.' : 'Загрузите фотографию, MP4-видео или PDF сюда либо прямо из редактора.'}</Typography></div> : null}
    <div className="admin-media-grid">{visible.map((asset) => <figure key={asset.id} className="admin-media-tile">{isVideoMedia(asset.contentType) ? <video controls muted playsInline preload="metadata" src={resolveAdminImagePreview(asset.publicUrl)} /> : isDocumentMedia(asset.contentType) ? <a className="admin-media-document" href={resolveAdminImagePreview(asset.publicUrl)} rel="noreferrer" target="_blank">PDF</a> : <img src={resolveAdminImagePreview(asset.publicUrl)} alt="" loading="lazy" />}<Typography as="figcaption" variant="caption"><Typography title={asset.filename} variant="bodySmMedium">{asset.filename}</Typography><Typography as="small" variant="caption" tone="muted">{isVideoMedia(asset.contentType) ? 'MP4 · ' : isDocumentMedia(asset.contentType) ? 'PDF · ' : ''}{formatBytes(asset.byteSize)} · {formatDate(asset.createdAt)}</Typography><Button size="xs" type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(asset.publicUrl)}>Скопировать ссылку</Button></Typography></figure>)}</div>
  </section>
}
