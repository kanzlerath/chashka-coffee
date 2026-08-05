import { Button } from '@/components/ui/button'

export function AdminDraftRecovery({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: string
  onRestore: () => void
  onDiscard: () => void
}) {
  return (
    <aside className="admin-draft-recovery" role="status">
      <div>
        <strong>Найден несохранённый черновик</strong>
        <span>{new Date(savedAt).toLocaleString('ru-RU')}</span>
      </div>
      <Button size="sm" type="button" onClick={onRestore}>Восстановить</Button>
      <Button size="sm" type="button" variant="ghost" onClick={onDiscard}>Удалить</Button>
    </aside>
  )
}
