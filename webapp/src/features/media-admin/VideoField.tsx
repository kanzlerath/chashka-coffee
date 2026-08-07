import { SearchIcon, Upload01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { mediaAssetListResponseSchema, type MediaAsset } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Typography } from '@/components/ui/typography'
import { useAuth } from '@/features/auth'

import { isVideoMedia, resolveAdminImagePreview, supportedVideoTypes, uploadMediaFile } from './media-utils'

function VideoPickerDialog({ open, value, onOpenChange, onSelect }: { open: boolean; value: string | null; onOpenChange: (open: boolean) => void; onSelect: (url: string) => void }) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const assets = useQuery({ queryKey: ['admin', 'media'], queryFn: () => api.request('/api/admin/media', mediaAssetListResponseSchema), enabled: open })
  const upload = useMutation({
    mutationFn: (file: File) => uploadMediaFile(api, file),
    onSuccess: ({ asset }: { asset: MediaAsset }) => {
      setUploadError(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
      onSelect(asset.publicUrl)
      onOpenChange(false)
    },
  })
  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru')
    return assets.data?.assets.filter((asset) => isVideoMedia(asset.contentType) && (!normalized || asset.filename.toLocaleLowerCase('ru').includes(normalized))) ?? []
  }, [assets.data, query])
  const uploadFile = (file: File | undefined) => {
    if (!file) return
    if (!supportedVideoTypes.has(file.type)) {
      setUploadError('Поддерживается только MP4-видео.')
      return
    }
    setUploadError(null)
    upload.mutate(file)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="admin-media-picker-dialog">
      <DialogHeader><DialogTitle>Выбрать видео</DialogTitle><DialogDescription>Поддерживается MP4 до установленного лимита. Видео сохраняется в публичной медиатеке и сразу доступно для выбора.</DialogDescription></DialogHeader>
      <div className="admin-media-picker-tools">
        <InputGroup><InputGroupAddon align="inline-start"><HugeiconsIcon icon={SearchIcon} size={17} strokeWidth={1.8} /></InputGroupAddon><InputGroupInput autoFocus aria-label="Поиск видео" placeholder="Название файла…" value={query} onChange={(event) => setQuery(event.target.value)} /></InputGroup>
        <Input ref={fileInput} accept="video/mp4" className="sr-only" type="file" onChange={(event) => { uploadFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
        <Button disabled={upload.isPending} type="button" variant="outline" onClick={() => fileInput.current?.click()}><HugeiconsIcon icon={Upload01Icon} size={17} strokeWidth={1.8} />{upload.isPending ? 'Загружаем…' : 'Загрузить MP4'}</Button>
      </div>
      {upload.isError || uploadError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">{uploadError ?? (upload.error instanceof Error ? upload.error.message : 'Не удалось загрузить видео.')}</Typography> : null}
      {assets.isPending ? <Typography className="admin-state-message" variant="bodySm">Загружаем медиатеку…</Typography> : null}
      {assets.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось загрузить медиатеку.</Typography> : null}
      {!assets.isPending && !assets.isError && visibleAssets.length === 0 ? <div className="admin-media-picker-empty"><Typography variant="bodySmMedium">{query ? 'Ничего не найдено' : 'Видео пока нет'}</Typography><Typography variant="bodySm" tone="muted">Загрузите MP4 — оно сразу станет доступно для этого блока.</Typography></div> : null}
      <div className="admin-media-picker-grid">{visibleAssets.map((asset) => <button className="admin-media-picker-item" data-selected={asset.publicUrl === value || undefined} key={asset.id} type="button" onClick={() => { onSelect(asset.publicUrl); onOpenChange(false) }}><video muted playsInline preload="metadata" src={resolveAdminImagePreview(asset.publicUrl)} /><Typography title={asset.filename} variant="caption">{asset.filename}</Typography></button>)}</div>
    </DialogContent>
  </Dialog>
}

export function AdminVideoField({ value, onChange, required = false }: { value: string | null; onChange: (value: string | null) => void; required?: boolean }) {
  const [open, setOpen] = useState(false)
  return <div className="admin-image-field admin-video-field">
    <button aria-label={value ? 'Заменить видео' : 'Выбрать видео'} className="admin-image-field-preview" type="button" onClick={() => setOpen(true)}>{value ? <video muted playsInline preload="metadata" src={resolveAdminImagePreview(value)} /> : <Typography variant="bodySm" tone="muted">Видео не выбрано</Typography>}</button>
    <div className="admin-image-field-actions">
      <Button size="sm" type="button" variant="outline" onClick={() => setOpen(true)}>{value ? 'Заменить' : 'Выбрать видео'}</Button>
      {value && !required ? <Button size="sm" type="button" variant="ghost" onClick={() => onChange(null)}>Убрать</Button> : null}
      <details><summary><Typography variant="caption">Указать ссылку вручную</Typography></summary><Input required={required} inputMode="url" placeholder="/uploads/media/…/video.mp4 или https://…" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} /></details>
    </div>
    <VideoPickerDialog open={open} value={value} onOpenChange={setOpen} onSelect={(url) => onChange(url)} />
  </div>
}
