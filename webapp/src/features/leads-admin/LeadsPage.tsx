import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leadListResponseSchema, leadResponseSchema, updateLeadStatusRequestSchema, type Lead, type LeadStatus } from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth'

const statusLabel: Record<LeadStatus, string> = { NEW: 'Новая', IN_PROGRESS: 'В работе', CLOSED: 'Закрыта' }
const typeLabel: Record<Lead['type'], string> = { CONTACT: 'Общий вопрос', RESERVATION: 'Бронирование', FRANCHISE: 'Франшиза', BANQUET: 'Банкет', JOB: 'Вакансия' }

export function LeadsPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'ALL' | LeadStatus>('ALL')
  const leads = useQuery({ queryKey: ['admin', 'leads'], queryFn: () => api.request('/api/admin/leads', leadListResponseSchema) })
  const visible = useMemo(() => leads.data?.leads.filter((lead) => filter === 'ALL' || lead.status === filter) ?? [], [filter, leads.data])
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) => api.request(`/api/admin/leads/${id}/status`, leadResponseSchema, { method: 'PUT', body: updateLeadStatusRequestSchema.parse({ status }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] }),
  })

  return <section className="mx-auto grid w-full max-w-6xl gap-7 px-5 py-9">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5"><div><h1 className="text-2xl font-semibold tracking-tight">Заявки</h1><p className="mt-1 text-sm text-muted-foreground">Сообщения с сайта: связь, бронь, банкет, франшиза и вакансии.</p></div><div className="flex flex-wrap gap-2" aria-label="Фильтр заявок">{(['ALL', 'NEW', 'IN_PROGRESS', 'CLOSED'] as const).map((status) => <Button key={status} type="button" size="sm" variant={filter === status ? 'default' : 'outline'} onClick={() => setFilter(status)}>{status === 'ALL' ? 'Все' : statusLabel[status]}</Button>)}</div></header>
    {leads.isPending && <p className="text-sm text-muted-foreground">Загружаем заявки…</p>}
    {leads.isError && <p className="text-sm text-destructive">Не удалось загрузить заявки. Проверьте доступ и повторите попытку.</p>}
    {!leads.isPending && !leads.isError && visible.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Здесь появятся обращения с сайта.</p>}
    <div className="divide-y border-y">{visible.map((lead) => <article key={lead.id} className="grid gap-4 py-5 lg:grid-cols-[180px_minmax(0,1fr)_150px]"><div><p className="text-sm font-medium">{typeLabel[lead.type]}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleString('ru-RU')}</p></div><div className="min-w-0"><h2 className="font-semibold">{lead.name}</h2><p className="mt-1 text-sm text-muted-foreground">{[lead.phone, lead.email].filter(Boolean).join(' · ') || 'Контакты не указаны'}</p>{lead.message && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6">{lead.message}</p>}{lead.metadata && <p className="mt-3 text-xs text-muted-foreground">{Object.entries(lead.metadata).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}</div><label className="grid h-fit gap-1 text-xs font-medium text-muted-foreground">Статус<select className="h-9 rounded-md border bg-background px-2 text-sm text-foreground" disabled={update.isPending} value={lead.status} onChange={(event) => update.mutate({ id: lead.id, status: event.target.value as LeadStatus })}>{(['NEW', 'IN_PROGRESS', 'CLOSED'] as const).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label></article>)}</div>
    {update.isError && <p className="text-sm text-destructive">Не удалось обновить статус заявки.</p>}
  </section>
}
