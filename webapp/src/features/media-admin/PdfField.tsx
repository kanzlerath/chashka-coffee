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

import { isDocumentMedia, supportedDocumentTypes, uploadMediaFile } from './media-utils'

function PdfPickerDialog({ open, value, onOpenChange, onSelect }: { open: boolean; value: string | null; onOpenChange: (open: boolean) => void; onSelect: (url: string) => void }) {
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
    return assets.data?.assets.filter((asset) => isDocumentMedia(asset.contentType) && (!normalized || asset.filename.toLocaleLowerCase('ru').includes(normalized))) ?? []
  }, [assets.data, query])
  const uploadFile = (file: File | undefined) => {
    if (!file) return
    if (!supportedDocumentTypes.has(file.type)) {
      setUploadError('Поддерживается только PDF-файл.')
      return
    }
    setUploadError(null)
    upload.mutate(file)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="admin-media-picker-dialog">
      <DialogHeader><DialogTitle>Выбрать PDF</DialogTitle><DialogDescription>Файл сохранится в публичной медиатеке и будет доступен посетителям по кнопке скачивания меню.</DialogDescription></DialogHeader>
      <div className="admin-media-picker-tools">
        <InputGroup><InputGroupAddon align="inline-start"><HugeiconsIcon icon={SearchIcon} size={17} strokeWidth={1.8} /></InputGroupAddon><InputGroupInput autoFocus aria-label="Поиск PDF" placeholder="Название файла…" value={query} onChange={(event) => setQuery(event.target.value)} /></InputGroup>
        <Input ref={fileInput} accept="application/pdf" className="sr-only" type="file" onChange={(event) => { uploadFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
        <Button disabled={upload.isPending} type="button" variant="outline" onClick={() => fileInput.current?.click()}><HugeiconsIcon icon={Upload01Icon} size={17} strokeWidth={1.8} />{upload.isPending ? 'Загружаем…' : 'Загрузить PDF'}</Button>
      </div>
      {upload.isError || uploadError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">{uploadError ?? (upload.error instanceof Error ? upload.error.message : 'Не удалось загрузить PDF.')}</Typography> : null}
      {assets.isPending ? <Typography className="admin-state-message" variant="bodySm">Загружаем медиатеку…</Typography> : null}
      {assets.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось загрузить медиатеку.</Typography> : null}
      {!assets.isPending && !assets.isError && visibleAssets.length === 0 ? <div className="admin-media-picker-empty"><Typography variant="bodySmMedium">{query ? 'Ничего не найдено' : 'PDF пока нет'}</Typography><Typography variant="bodySm" tone="muted">Загрузите PDF — он сразу станет доступен для этого ресторана.</Typography></div> : null}
      <div className="admin-media-picker-grid">{visibleAssets.map((asset) => <button className="admin-media-picker-item admin-document-picker-item" data-selected={asset.publicUrl === value || undefined} key={asset.id} type="button" onClick={() => { onSelect(asset.publicUrl); onOpenChange(false) }}><span>PDF</span><Typography title={asset.filename} variant="caption">{asset.filename}</Typography></button>)}</div>
    </DialogContent>
  </Dialog>
}

export function AdminPdfField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const [open, setOpen] = useState(false)
  return <div className="admin-image-field admin-pdf-field">
    <button aria-label={value ? 'Заменить PDF меню' : 'Выбрать PDF меню'} className="admin-image-field-preview" type="button" onClick={() => setOpen(true)}>{value ? <span className="admin-file-preview">PDF</span> : <Typography variant="bodySm" tone="muted">PDF не выбран</Typography>}</button>
    <div className="admin-image-field-actions">
      <Button size="sm" type="button" variant="outline" onClick={() => setOpen(true)}>{value ? 'Заменить' : 'Выбрать PDF'}</Button>
      {value ? <Button size="sm" type="button" variant="ghost" onClick={() => onChange(null)}>Убрать</Button> : null}
      <details><summary><Typography variant="caption">Указать ссылку вручную</Typography></summary><Input inputMode="url" placeholder="/uploads/media/…/menu.pdf или https://…" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} /></details>
    </div>
    <PdfPickerDialog open={open} value={value} onOpenChange={setOpen} onSelect={onChange} />
  </div>
}
