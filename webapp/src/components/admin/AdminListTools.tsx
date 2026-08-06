import { SearchIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

export function AdminListToolbar<T extends string>({
  query,
  onQueryChange,
  status,
  onStatusChange,
  statusOptions,
  placeholder = 'Поиск…',
}: {
  query: string
  onQueryChange: (value: string) => void
  status: T
  onStatusChange: (value: T) => void
  statusOptions: Array<{ value: T; label: string }>
  placeholder?: string
}) {
  return <div className="admin-list-toolbar">
    <InputGroup className="admin-list-search">
      <InputGroupAddon align="inline-start"><HugeiconsIcon icon={SearchIcon} size={17} strokeWidth={1.8} /></InputGroupAddon>
      <InputGroupInput aria-label="Поиск" placeholder={placeholder} value={query} onChange={(event) => onQueryChange(event.target.value)} />
    </InputGroup>
    <select aria-label="Фильтр по статусу" value={status} onChange={(event) => onStatusChange(event.target.value as T)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
  </div>
}

export function AdminBulkBar<T extends string>({
  count,
  action,
  onActionChange,
  options,
  pending,
  onApply,
  onClear,
}: {
  count: number
  action: T
  onActionChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  pending: boolean
  onApply: () => void
  onClear: () => void
}) {
  if (count === 0) return null
  return <div className="admin-bulk-bar" role="region" aria-label="Массовые действия">
    <strong>Выбрано: {count}</strong>
    <select aria-label="Новое состояние" value={action} onChange={(event) => onActionChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    <Button disabled={pending} size="sm" type="button" onClick={onApply}>{pending ? 'Обновляем…' : 'Применить'}</Button>
    <Button size="sm" type="button" variant="ghost" onClick={onClear}>Снять выбор</Button>
  </div>
}
