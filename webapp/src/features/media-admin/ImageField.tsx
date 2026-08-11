import { SearchIcon, Upload01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { mediaAssetListResponseSchema, type CardImageCrop, type ImageFocus, type MediaAsset } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Typography } from '@/components/ui/typography'
import { useAuth } from '@/features/auth'

import { resolveAdminImagePreview, supportedImageTypes, uploadMediaFile } from './media-utils'

type CropAspect = 'ORIGINAL' | 'CARD' | '16:9' | '4:3' | '1:1' | '4:5' | '9:16'
const mediaPickerPageSize = 18

const aspectValue: Record<Exclude<CropAspect, 'ORIGINAL'>, number> = {
  CARD: 1 / 0.86,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
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

function MediaPickerDialog({ open, value, onOpenChange, onSelect, allowUploadCrop = true }: { open: boolean; value: string | null; onOpenChange: (open: boolean) => void; onSelect: (url: string) => void; allowUploadCrop?: boolean }) {
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
    <DialogContent className={`admin-media-picker-dialog${file ? '' : ' admin-media-picker-dialog--library'}`}>
      <DialogHeader>
        <DialogTitle>{file ? 'Подготовить фотографию' : 'Выбрать фотографию'}</DialogTitle>
        <DialogDescription>{file ? 'Оставьте оригинал или подготовьте отдельный кадр для этого места.' : allowUploadCrop ? 'Найдите загруженный файл или добавьте новый. SVG здесь намеренно не показываются.' : 'Выберите или загрузите исходную фотографию. Точку центра для первого экрана можно будет поставить следующим шагом.'}</DialogDescription>
      </DialogHeader>

      {file && filePreview ? <div className="admin-crop-workspace">
        {aspect === 'ORIGINAL'
          ? <div className="admin-crop-preview" data-aspect={aspect}><img src={filePreview} alt="Предпросмотр кадрирования" /></div>
          : <CropPreviewImage src={filePreview} alt="Предпросмотр кадрирования" aspect={aspect} focusX={focusX} focusY={focusY} zoom={zoom} />}
        <div className="admin-crop-controls">
          <label><Typography variant="label">Формат кадра</Typography><select value={aspect} onChange={(event) => { setAspect(event.target.value as CropAspect); setZoom(1) }}><option value="ORIGINAL">Оригинал без обрезки</option><option value="CARD">Карточка товара · 1:0,86</option><option value="16:9">Широкий · 16:9</option><option value="4:3">Горизонтальный · 4:3</option><option value="1:1">Квадрат · 1:1</option><option value="4:5">Вертикальный · 4:5</option><option value="9:16">Экран телефона · 9:16</option></select></label>
          {aspect !== 'ORIGINAL' ? <>
            <label><Typography variant="label">Приближение · {zoom.toFixed(1)}×</Typography><input min="1" max="2" step="0.05" type="range" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
            <div className="admin-crop-axis"><label><Typography variant="label">Фокус по горизонтали</Typography><input min="0" max="100" type="range" value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} /></label><label><Typography variant="label">Фокус по вертикали</Typography><input min="0" max="100" type="range" value={focusY} onChange={(event) => setFocusY(Number(event.target.value))} /></label></div>
          </> : null}
        </div>
        {upload.isError || prepareError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">{prepareError ?? (upload.error instanceof Error ? upload.error.message : 'Не удалось загрузить фотографию.')}</Typography> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setFile(null)}>Назад</Button><Button disabled={upload.isPending} type="button" onClick={() => void submitCrop()}>{upload.isPending ? 'Загружаем…' : aspect === 'ORIGINAL' ? 'Загрузить оригинал' : 'Создать кадр и выбрать'}</Button></DialogFooter>
      </div> : <div className="admin-media-picker-library">
        <div className="admin-media-picker-tools">
          <InputGroup><InputGroupAddon align="inline-start"><HugeiconsIcon icon={SearchIcon} size={17} strokeWidth={1.8} /></InputGroupAddon><InputGroupInput autoFocus aria-label="Поиск по медиатеке" placeholder="Название файла…" value={query} onChange={(event) => setQuery(event.target.value)} /></InputGroup>
          <Input ref={fileInput} accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" type="file" onChange={(event) => { const next = event.target.files?.[0]; if (next) { if (allowUploadCrop) setFile(next); else upload.mutate(next) }; event.currentTarget.value = '' }} />
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><HugeiconsIcon icon={Upload01Icon} size={17} strokeWidth={1.8} />Загрузить</Button>
        </div>
        <div className="admin-media-picker-status">
          {upload.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">{upload.error instanceof Error ? upload.error.message : 'Не удалось загрузить фотографию.'}</Typography> : null}
          {assets.isPending ? <Typography className="admin-state-message" variant="bodySm">Загружаем медиатеку…</Typography> : null}
          {assets.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось загрузить медиатеку.</Typography> : null}
          {!assets.isPending && !assets.isError && visibleAssets.length === 0 ? <div className="admin-media-picker-empty"><Typography variant="bodySmMedium">{query ? 'Ничего не найдено' : 'Медиатека пока пуста'}</Typography><Typography variant="bodySm" tone="muted">{query ? 'Попробуйте другое название.' : 'Загрузите первую фотографию — она сразу появится во всех редакторах.'}</Typography></div> : null}
        </div>
        <div className="admin-media-picker-grid">{displayedAssets.map((asset) => <button className="admin-media-picker-item" data-selected={asset.publicUrl === value || undefined} key={asset.id} type="button" onClick={() => { onSelect(asset.publicUrl); onOpenChange(false) }}><img src={resolveAdminImagePreview(asset.thumbnailUrl ?? asset.publicUrl)} alt="" decoding="async" fetchPriority="low" loading="lazy" /><Typography title={asset.filename} variant="caption">{asset.filename}</Typography></button>)}</div>
        {visibleAssets.length > displayedAssets.length ? <Button className="justify-self-center" type="button" variant="outline" onClick={() => setVisibleCount((count) => count + mediaPickerPageSize)}>Показать ещё · {visibleAssets.length - displayedAssets.length}</Button> : null}
      </div>}
    </DialogContent>
  </Dialog>
}

function cropBox(width: number, height: number, aspect: Exclude<CropAspect, 'ORIGINAL'>, focusX: number, focusY: number, zoom: number) {
  let cropWidth = width
  let cropHeight = cropWidth / aspectValue[aspect]
  if (cropHeight > height) {
    cropHeight = height
    cropWidth = cropHeight * aspectValue[aspect]
  }
  cropWidth /= zoom
  cropHeight /= zoom
  return {
    left: (width - cropWidth) * (focusX / 100),
    top: (height - cropHeight) * (focusY / 100),
    width: cropWidth,
    height: cropHeight,
  }
}

function focusCropBox(width: number, height: number, aspect: Exclude<CropAspect, 'ORIGINAL'>, focusX: number, focusY: number) {
  let cropWidth = width
  let cropHeight = cropWidth / aspectValue[aspect]
  if (cropHeight > height) {
    cropHeight = height
    cropWidth = cropHeight * aspectValue[aspect]
  }
  return {
    left: Math.min(Math.max((width * focusX / 100) - cropWidth / 2, 0), width - cropWidth),
    top: Math.min(Math.max((height * focusY / 100) - cropHeight / 2, 0), height - cropHeight),
    width: cropWidth,
    height: cropHeight,
  }
}

function CropPreviewImage({ src, alt, aspect, focusX, focusY, zoom, className, centerFocus = false }: { src: string; alt: string; aspect: Exclude<CropAspect, 'ORIGINAL'>; focusX: number; focusY: number; zoom: number; className?: string; centerFocus?: boolean }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const crop = dimensions ? centerFocus ? focusCropBox(dimensions.width, dimensions.height, aspect, focusX, focusY) : cropBox(dimensions.width, dimensions.height, aspect, focusX, focusY, zoom) : null
  const imageStyle = crop && dimensions ? {
    position: 'absolute' as const,
    width: `${(dimensions.width / crop.width) * 100}%`,
    height: `${(dimensions.height / crop.height) * 100}%`,
    left: `-${(crop.left / crop.width) * 100}%`,
    top: `-${(crop.top / crop.height) * 100}%`,
  } : undefined

  return <div className={`admin-crop-preview admin-precise-crop-preview${className ? ` ${className}` : ''}`} data-aspect={aspect}>
    <img src={src} alt={alt} style={imageStyle} onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
  </div>
}

function CardCropPreview({ src, focusX, focusY }: { src: string; focusX: number; focusY: number }) {
  return <article className="admin-card-crop-card" aria-label="Предпросмотр карточки на сайте">
    <CropPreviewImage className="admin-card-crop-image" src={src} alt="Предпросмотр кадра для карточки" aspect="CARD" focusX={focusX} focusY={focusY} zoom={1} centerFocus />
    <div className="admin-card-crop-copy"><Typography variant="caption">Так увидит гость</Typography><Typography variant="bodySmMedium">Карточка товара</Typography><span /></div>
  </article>
}

function MediaCardCropDialog({ open, value, crop, onOpenChange, onSelect }: { open: boolean; value: string; crop: CardImageCrop | null; onOpenChange: (open: boolean) => void; onSelect: (crop: CardImageCrop) => void }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [focus, setFocus] = useState<ImageFocus>(defaultImageFocus)
  useEffect(() => {
    if (!dimensions) return
    if (!crop) { setFocus(defaultImageFocus); return }
    const currentCrop = cropBox(dimensions.width, dimensions.height, 'CARD', crop.focusX, crop.focusY, crop.zoom)
    setFocus({ x: ((currentCrop.left + currentCrop.width / 2) / dimensions.width) * 100, y: ((currentCrop.top + currentCrop.height / 2) / dimensions.height) * 100 })
  }, [crop, dimensions])
  const selectPoint = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setFocus({ x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)), y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)) })
  }
  const save = () => {
    if (!dimensions) return
    const card = focusCropBox(dimensions.width, dimensions.height, 'CARD', focus.x, focus.y)
    onSelect({
      focusX: dimensions.width === card.width ? 50 : (card.left / (dimensions.width - card.width)) * 100,
      focusY: dimensions.height === card.height ? 50 : (card.top / (dimensions.height - card.height)) * 100,
      zoom: 1,
    })
    onOpenChange(false)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="admin-media-picker-dialog admin-image-focus-dialog">
      <DialogHeader><DialogTitle>Выберите центр карточки</DialogTitle><DialogDescription>Кликните по объекту, который должен быть в центре карточек меню, кофе и тортов. Исходный файл и медиатека не меняются.</DialogDescription></DialogHeader>
      <div className="admin-image-focus-workspace">
        <button aria-label="Выбрать центр фотографии для карточки" className="admin-image-focus-picker" type="button" onClick={selectPoint}>
          <img src={resolveAdminImagePreview(value)} alt="Исходная фотография" onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
          <span aria-hidden="true" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
        </button>
        <div className="admin-card-crop-preview"><Typography variant="caption">Так увидит гость</Typography><CardCropPreview src={resolveAdminImagePreview(value)} focusX={focus.x} focusY={focus.y} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button><Button disabled={!dimensions} type="button" onClick={save}>Сохранить точку</Button></DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
}

const defaultImageFocus: ImageFocus = { x: 50, y: 50 }

function ImageFocusDialog({ open, value, focus, onOpenChange, onSelect }: { open: boolean; value: string; focus: ImageFocus | null; onOpenChange: (open: boolean) => void; onSelect: (focus: ImageFocus) => void }) {
  const [nextFocus, setNextFocus] = useState(focus ?? defaultImageFocus)
  useEffect(() => { if (open) setNextFocus(focus ?? defaultImageFocus) }, [focus, open])
  const selectPoint = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setNextFocus({
      x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)),
    })
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="admin-media-picker-dialog admin-image-focus-dialog">
      <DialogHeader><DialogTitle>Выберите центр первого экрана</DialogTitle><DialogDescription>Кликните по объекту, который должен оказаться в центре. Сайт заполнит экран фотографией и сохранит эту точку и на компьютере, и на телефоне.</DialogDescription></DialogHeader>
      <div className="admin-image-focus-workspace">
        <button aria-label="Выбрать центр фотографии" className="admin-image-focus-picker" type="button" onClick={selectPoint}>
          <img src={resolveAdminImagePreview(value)} alt="Исходная фотография" />
          <span aria-hidden="true" style={{ left: `${nextFocus.x}%`, top: `${nextFocus.y}%` }} />
        </button>
        <div className="admin-image-focus-previews">
          <div><Typography variant="caption">Компьютер · широкий экран</Typography><CropPreviewImage src={resolveAdminImagePreview(value)} alt="Предпросмотр первого экрана на компьютере" aspect="16:9" focusX={nextFocus.x} focusY={nextFocus.y} zoom={1} centerFocus /></div>
          <div><Typography variant="caption">Телефон · вертикальный экран</Typography><CropPreviewImage src={resolveAdminImagePreview(value)} alt="Предпросмотр первого экрана на телефоне" aspect="9:16" focusX={nextFocus.x} focusY={nextFocus.y} zoom={1} centerFocus /></div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button><Button type="button" onClick={() => { onSelect(nextFocus); onOpenChange(false) }}>Сохранить точку</Button></DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
}

export function AdminImageField({ value, onChange, required = false, compact = false, cardCrop = false, imageCrop = null, onImageCropChange, imageFocus = null, onImageFocusChange }: { value: string | null; onChange: (value: string | null) => void; required?: boolean; compact?: boolean; cardCrop?: boolean; imageCrop?: CardImageCrop | null; onImageCropChange?: (crop: CardImageCrop | null) => void; imageFocus?: ImageFocus | null; onImageFocusChange?: (focus: ImageFocus | null) => void }) {
  const [open, setOpen] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  return <div className="admin-image-field" data-compact={compact || undefined}>
    <button aria-label={value ? 'Заменить фотографию' : 'Выбрать фотографию'} className="admin-image-field-preview" type="button" onClick={() => setOpen(true)}>{value ? <img src={resolveAdminImagePreview(value)} alt="" /> : <Typography variant="bodySm" tone="muted">Фотография не выбрана</Typography>}</button>
    <div className="admin-image-field-actions">
      <Button size="sm" type="button" variant="outline" onClick={() => setOpen(true)}>{value ? 'Заменить' : 'Выбрать фотографию'}</Button>
      {value && cardCrop && onImageCropChange ? <Button size="sm" type="button" variant="outline" onClick={() => setCropOpen(true)}>{imageCrop ? 'Изменить центр' : 'Выбрать центр'}</Button> : null}
      {value && imageCrop && onImageCropChange ? <Button size="sm" type="button" variant="ghost" onClick={() => onImageCropChange(null)}>Сбросить центр</Button> : null}
      {value && onImageFocusChange ? <Button size="sm" type="button" variant="outline" onClick={() => setFocusOpen(true)}>{imageFocus ? 'Изменить центр' : 'Выбрать центр'}</Button> : null}
      {value && imageFocus && onImageFocusChange ? <Button size="sm" type="button" variant="ghost" onClick={() => onImageFocusChange(null)}>Сбросить центр</Button> : null}
      {value && !required ? <Button size="sm" type="button" variant="ghost" onClick={() => onChange(null)}>Убрать</Button> : null}
      <details><summary><Typography variant="caption">Указать ссылку вручную</Typography></summary><Input required={required} inputMode="url" placeholder="/images/photo.webp или https://…" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} /></details>
    </div>
    <MediaPickerDialog open={open} value={value} onOpenChange={setOpen} onSelect={(url) => onChange(url)} allowUploadCrop={!onImageFocusChange} />
    {cropOpen && value && cardCrop && onImageCropChange ? <MediaCardCropDialog open value={value} crop={imageCrop} onOpenChange={setCropOpen} onSelect={onImageCropChange} /> : null}
    {focusOpen && value && onImageFocusChange ? <ImageFocusDialog open value={value} focus={imageFocus} onOpenChange={setFocusOpen} onSelect={onImageFocusChange} /> : null}
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
