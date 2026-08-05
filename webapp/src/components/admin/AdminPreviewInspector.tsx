import { EyeIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

export type AdminPreview = {
  eyebrow?: string
  title: string
  description?: string | null
  imageUrl?: string | null
  badge?: string | null
  meta?: Array<string | null | undefined>
  body?: ReactNode
}

export function AdminPreviewInspector({ preview }: { preview: AdminPreview }) {
  return (
    <Sheet>
      <SheetTrigger asChild><Button type="button" variant="outline"><HugeiconsIcon icon={EyeIcon} size={17} strokeWidth={1.8} />Предпросмотр</Button></SheetTrigger>
      <SheetContent className="admin-preview-sheet sm:max-w-xl">
        <SheetHeader className="admin-preview-header">
          <SheetTitle>Предпросмотр</SheetTitle>
          <SheetDescription>Черновик — без публикации и выхода из редактора.</SheetDescription>
        </SheetHeader>
        <div className="admin-preview-canvas">
          {preview.imageUrl ? <figure><img alt="" src={preview.imageUrl} /></figure> : <div className="admin-preview-placeholder">Изображение не выбрано</div>}
          <div className="admin-preview-copy">
            {preview.eyebrow ? <span>{preview.eyebrow}</span> : null}
            <h2>{preview.title || 'Без названия'}</h2>
            {preview.description ? <p>{preview.description}</p> : null}
            {preview.meta?.filter(Boolean).length ? <ul>{preview.meta.filter(Boolean).map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ul> : null}
            {preview.badge ? <b>{preview.badge}</b> : null}
            {preview.body ? <div className="admin-preview-body">{preview.body}</div> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
