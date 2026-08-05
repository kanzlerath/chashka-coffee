import { Clock01Icon, FloppyDiskIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import type { AdminPreview } from './AdminPreviewInspector'
import { AdminPreviewInspector } from './AdminPreviewInspector'

type StatusOption<T extends string> = { value: T; label: string; hint: string }

export function AdminPublicationPanel<T extends string>({
  formId,
  status,
  options,
  onStatusChange,
  isDirty,
  isSaving,
  savedAt,
  preview,
  saveLabel = 'Сохранить',
  scheduleAt,
  onScheduleAtChange,
}: {
  formId: string
  status: T
  options: Array<StatusOption<T>>
  onStatusChange: (status: T) => void
  isDirty: boolean
  isSaving: boolean
  savedAt?: string
  preview: AdminPreview
  saveLabel?: string
  scheduleAt?: string | null
  onScheduleAtChange?: (value: string | null) => void
}) {
  const current = options.find((option) => option.value === status) ?? options[0]
  return (
    <aside className="admin-publication-panel">
      <div className="admin-publication-state">
        <span className={`admin-status-dot admin-status-dot-${status.toLowerCase()}`} />
        <div><strong>{current?.label}</strong><small>{current?.hint}</small></div>
      </div>
      <label className="admin-field">
        <span className="admin-field-label">Статус</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as T)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {status === 'SCHEDULED' && onScheduleAtChange ? <label className="admin-field"><span className="admin-field-label">Дата публикации</span><input required type="datetime-local" value={scheduleAt ? scheduleAt.slice(0, 16) : ''} onChange={(event) => onScheduleAtChange(event.target.value ? new Date(event.target.value).toISOString() : null)} /></label> : null}
      <div className="admin-publication-save-state">
        <HugeiconsIcon icon={Clock01Icon} size={16} strokeWidth={1.8} />
        <span>{isDirty ? 'Есть несохранённые изменения' : savedAt ? `Сохранено ${new Date(savedAt).toLocaleString('ru-RU')}` : 'Изменений нет'}</span>
      </div>
      <div className="admin-publication-actions">
        <Button disabled={isSaving} form={formId} type="submit"><HugeiconsIcon icon={FloppyDiskIcon} size={17} strokeWidth={1.8} />{isSaving ? 'Сохраняем…' : saveLabel}</Button>
        <AdminPreviewInspector preview={preview} />
      </div>
    </aside>
  )
}
