import { SearchIcon, Upload01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { mediaAssetListResponseSchema, type MediaAsset } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Typography } from '@/components/ui/typography'
import { useAuth } from '@/features/auth'

import { resolveAdminImagePreview, supportedImageTypes, uploadMediaFile } from './media-utils'

type CropAspect = 'ORIGINAL' | '16:9' | '4:3' | '1:1' | '4:5'
const mediaPickerPageSize = 18

const aspectValue: Record<Exclude<CropAspect, 'ORIGINAL'>, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '4:5': 4 / 5,
}

function useMediaUpload(onUploaded?: (asset: MediaAsset) => void) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadMediaFile(api, file),
    onSuccess: ({ asset }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
      onUploaded?.(asset)
    },
  })
}

async function cropFile(file: File, aspect: CropAspect, zoom: number, focusX: number, focusY: number) {
  if (aspect === 'ORIGINAL') return file
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Не удалось прочитать изображение.'))
      element.src = sourceUrl
    })
    const ratio = aspectValue[aspect]
    let cropWidth = image.naturalWidth
    let cropHeight = cropWidth / ratio
    if (cropHeight > image.naturalHeight) {
      cropHeight = image.naturalHeight
      cropWidth = cropHeight * ratio
    }
    cropWidth /= zoom
    cropHeight /= zoom
    const sourceX = (image.naturalWidth - cropWidth) * (focusX / 100)
    const sourceY = (image.naturalHeight - cropHeight) * (focusY / 100)
    const scale = Math.min(1, 2_000 / Math.max(cropWidth, cropHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(cropWidth * scale))
    canvas.height = Math.max(1, Math.round(cropHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Браузер не поддерживает кадрирование.')
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Не удалось подготовить кадр.')), 'image/webp', 0.9))
    const stem = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${stem}-${aspect.replace(':', 'x')}.webp`, { type: 'image/webp' })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function MediaPickerDialog({ open, value, onOpenChange, onSelect }: { open: boolean; value: string | null; onOpenChange: (open: boolean) => void; onSelect: (url: string) => void }) {
  const { api } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [aspect, setAspect] = useState<CropAspect>('ORIGINAL')
  const [zoom, setZoom] = useState(1)
  const [focusX, setFocusX] = useState(50)
  const [focusY, setFocusY] = useState(50)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(mediaPickerPageSize)
  const assets = useQuery({ queryKey: ['admin', 'media'], queryFn: () => api.request('/api/admin/media', mediaAssetListResponseSchema), enabled: open })
  const resetPicker = () => {
    setFile(null)
    setQuery('')
    setAspect('ORIGINAL')
    setZoom(1)
    setFocusX(50)
    setFocusY(50)
    setPrepareError(null)
  }
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetPicker()
    onOpenChange(nextOpen)
  }
  const upload = useMediaUpload((asset) => {
    onSelect(asset.publicUrl)
    handleOpenChange(false)
  })

  const filePreview = useMemo(() => file ? URL.createObjectURL(file) : null, [file])
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview) }, [filePreview])

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru')
    return assets.data?.assets.filter((asset) => supportedImageTypes.has(asset.contentType) && (!normalized || asset.filename.toLocaleLowerCase('ru').includes(normalized))) ?? []
  }, [assets.data, query])
  const displayedAssets = visibleAssets.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(mediaPickerPageSize)
  }, [open, query])

  const submitCrop = async () => {
    if (!file) return
    setPrepareError(null)
    try {
      const prepared = await cropFile(file, aspect, zoom, focusX, focusY)
      upload.mutate(prepared)
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : 'Не удалось подготовить кадр.')
    }
  }

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent className="admin-media-picker-dialog">
      <DialogHeader>
        <DialogTitle>{file ? 'Подготовить фотографию' : 'Выбрать фотографию'}</DialogTitle>
        <DialogDescription>{file ? 'Оставьте оригинал или подготовьте отдельный кадр для этого места.' : 'Найдите загруженный файл или добавьте новый. SVG здесь намеренно не показываются.'}</DialogDescription>
      </DialogHeader>

      {file && filePreview ? <div className="admin-crop-workspace">
        <div className="admin-crop-preview" data-aspect={aspect}>
          <img src={filePreview} alt="Предпросмотр кадрирования" style={{ objectPosition: `${focusX}% ${focusY}%`, transform: `scale(${zoom})` }} />
        </div>
        <div className="admin-crop-controls">
          <label><Typography variant="label">Формат кадра</Typography><select value={aspect} onChange={(event) => { setAspect(event.target.value as CropAspect); setZoom(1) }}><option value="ORIGINAL">Оригинал без обрезки</option><option value="16:9">Широкий · 16:9</option><option value="4:3">Горизонтальный · 4:3</option><option value="1:1">Квадрат · 1:1</option><option value="4:5">Вертикальный · 4:5</option></select></label>
          {aspect !== 'ORIGINAL' ? <>
            <label><Typography variant="label">Приближение · {zoom.toFixed(1)}×</Typography><input min="1" max="2" step="0.05" type="range" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
            <div className="admin-crop-axis"><label><Typography variant="label">Фокус по горизонтали</Typography><input min="0" max="100" type="range" value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} /></label><label><Typography variant="label">Фокус по вертикали</Typography><input min="0" max="100" type="range" value={focusY} onChange={(event) => setFocusY(Number(event.target.value))} /></label></div>
          </> : null}
        </div>
        {upload.isError || prepareError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">{prepareError ?? (upload.error instanceof Error ? upload.error.message : 'Не удалось загрузить фотографию.')}</Typography> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setFile(null)}>Назад</Button><Button disabled={upload.isPending} type="button" onClick={() => void submitCrop()}>{upload.isPending ? 'Загружаем…' : aspect === 'ORIGINAL' ? 'Загрузить оригинал' : 'Создать кадр и выбрать'}</Button></DialogFooter>
      </div> : <>
        <div className="admin-media-picker-tools">
          <InputGroup><InputGroupAddon align="inline-start"><HugeiconsIcon icon={SearchIcon} size={17} strokeWidth={1.8} /></InputGroupAddon><InputGroupInput autoFocus aria-label="Поиск по медиатеке" placeholder="Название файла…" value={query} onChange={(event) => setQuery(event.target.value)} /></InputGroup>
          <Input ref={fileInput} accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" type="file" onChange={(event) => { const next = event.target.files?.[0]; if (next) setFile(next); event.currentTarget.value = '' }} />
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><HugeiconsIcon icon={Upload01Icon} size={17} strokeWidth={1.8} />Загрузить</Button>
        </div>
        {assets.isPending ? <Typography className="admin-state-message" variant="bodySm">Загружаем медиатеку…</Typography> : null}
        {assets.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось загрузить медиатеку.</Typography> : null}
        {!assets.isPending && !assets.isError && visibleAssets.length === 0 ? <div className="admin-media-picker-empty"><Typography variant="bodySmMedium">{query ? 'Ничего не найдено' : 'Медиатека пока пуста'}</Typography><Typography variant="bodySm" tone="muted">{query ? 'Попробуйте другое название.' : 'Загрузите первую фотографию — она сразу появится во всех редакторах.'}</Typography></div> : null}
        <div className="admin-media-picker-grid">{displayedAssets.map((asset) => <button className="admin-media-picker-item" data-selected={asset.publicUrl === value || undefined} key={asset.id} type="button" onClick={() => { onSelect(asset.publicUrl); onOpenChange(false) }}><img src={resolveAdminImagePreview(asset.publicUrl)} alt="" decoding="async" fetchPriority="low" loading="lazy" /><Typography title={asset.filename} variant="caption">{asset.filename}</Typography></button>)}</div>
        {visibleAssets.length > displayedAssets.length ? <Button className="justify-self-center" type="button" variant="outline" onClick={() => setVisibleCount((count) => count + mediaPickerPageSize)}>Показать ещё · {visibleAssets.length - displayedAssets.length}</Button> : null}
      </>}
    </DialogContent>
  </Dialog>
}

export function AdminImageField({ value, onChange, required = false, compact = false }: { value: string | null; onChange: (value: string | null) => void; required?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return <div className="admin-image-field" data-compact={compact || undefined}>
    <button aria-label={value ? 'Заменить фотографию' : 'Выбрать фотографию'} className="admin-image-field-preview" type="button" onClick={() => setOpen(true)}>{value ? <img src={resolveAdminImagePreview(value)} alt="" /> : <Typography variant="bodySm" tone="muted">Фотография не выбрана</Typography>}</button>
    <div className="admin-image-field-actions">
      <Button size="sm" type="button" variant="outline" onClick={() => setOpen(true)}>{value ? 'Заменить' : 'Выбрать фотографию'}</Button>
      {value && !required ? <Button size="sm" type="button" variant="ghost" onClick={() => onChange(null)}>Убрать</Button> : null}
      <details><summary><Typography variant="caption">Указать ссылку вручную</Typography></summary><Input required={required} inputMode="url" placeholder="/images/photo.webp или https://…" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} /></details>
    </div>
    <MediaPickerDialog open={open} value={value} onOpenChange={setOpen} onSelect={(url) => onChange(url)} />
  </div>
}

export function AdminImageListField({ value, onChange, max = 12 }: { value: string[]; onChange: (value: string[]) => void; max?: number }) {
  const [adding, setAdding] = useState(false)
  return <div className="admin-image-list-field">
    {value.map((url, index) => <div className="admin-image-list-item" key={`${url}-${index}`}><AdminImageField compact required value={url} onChange={(next) => next ? onChange(value.map((item, itemIndex) => itemIndex === index ? next : item)) : onChange(value.filter((_, itemIndex) => itemIndex !== index))} /><div><Button aria-label="Переместить выше" disabled={index === 0} size="xs" type="button" variant="ghost" onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next) }}>↑</Button><Button aria-label="Переместить ниже" disabled={index === value.length - 1} size="xs" type="button" variant="ghost" onClick={() => { const next = [...value]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; onChange(next) }}>↓</Button><Button size="xs" type="button" variant="ghost" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button></div></div>)}
    {value.length < max ? <Button type="button" variant="outline" onClick={() => setAdding(true)}>Добавить фотографию</Button> : null}
    <MediaPickerDialog open={adding} value={null} onOpenChange={setAdding} onSelect={(url) => onChange([...value, url])} />
  </div>
}
