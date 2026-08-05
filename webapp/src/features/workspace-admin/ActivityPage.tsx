import { Activity01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { adminActivityResponseSchema, type AuditEvent } from '@chashka-coffee/contracts'
import { useQuery } from '@tanstack/react-query'

import { AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth'

const actionLabel: Record<AuditEvent['action'], string> = { CREATE: 'создал(а)', UPDATE: 'изменил(а)', DELETE: 'удалил(а)', BULK_UPDATE: 'массово обновил(а)' }
const resourceLabel: Record<string, string> = { content: 'материал', products: 'товар', jobs: 'вакансию', leads: 'заявку', restaurants: 'ресторан', menus: 'меню', homepage: 'главную страницу', pages: 'страницу', users: 'доступ сотрудника', workspace: 'записи' }

export function ActivityPage() {
  const { api } = useAuth()
  const activity = useQuery({ queryKey: ['admin', 'workspace', 'activity'], queryFn: () => api.request('/api/admin/workspace/activity?limit=100', adminActivityResponseSchema) })
  return <section className="admin-page">
    <AdminPageHeader title="История изменений" actions={<Button disabled={activity.isFetching} type="button" variant="outline" onClick={() => void activity.refetch()}>Обновить</Button>} />
    <div className="admin-activity-list">
      {activity.data?.events.map((event) => <article key={event.id} className="admin-activity-row">
        <span className="admin-activity-icon"><HugeiconsIcon icon={Activity01Icon} size={18} strokeWidth={1.8} /></span>
        <div><strong>{event.actorName}</strong> {actionLabel[event.action]} {resourceLabel[event.resource] ?? event.resource}<small>{new Date(event.createdAt).toLocaleString('ru-RU')}</small></div>
        <code>{event.resourceId?.slice(0, 8) ?? '—'}</code>
      </article>)}
      {activity.isPending ? <p className="admin-state-message">Загружаем историю…</p> : null}
      {activity.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить историю.</p> : null}
      {!activity.isPending && activity.data?.events.length === 0 ? <p className="admin-empty-state">История появится после первого изменения в админке.</p> : null}
    </div>
  </section>
}
