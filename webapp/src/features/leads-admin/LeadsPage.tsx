import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminBulkUpdateRequestSchema, adminBulkUpdateResponseSchema, FOOTER_QUESTION_LEAD_SOURCE, hasPermission, leadListResponseSchema, leadResponseSchema, updateLeadStatusRequestSchema, type Lead, type LeadStatus } from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'

import { AdminBulkBar, AdminListToolbar, AdminPageHeader, AdminTabs } from '@/components/admin'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/features/auth'

const statusLabel: Record<LeadStatus, string> = { NEW: 'Новая', IN_PROGRESS: 'В работе', CLOSED: 'Закрыта' }
const typeLabel: Record<Lead['type'], string> = { CONTACT: 'Общий вопрос', RESERVATION: 'Бронирование', FRANCHISE: 'Франшиза', BANQUET: 'Банкет', JOB: 'Вакансия', EVENT_REGISTRATION: 'Регистрация на событие' }

const displayType = (lead: Lead) => lead.type === 'CONTACT' && lead.metadata?.source === FOOTER_QUESTION_LEAD_SOURCE ? 'Вопрос / идея' : typeLabel[lead.type]
const displayMetadata = (lead: Lead) => Object.entries(lead.metadata ?? {}).filter(([key, value]) => key !== 'source' || value !== FOOTER_QUESTION_LEAD_SOURCE)

export function LeadsPage() {
  const { api, user } = useAuth()
  const queryClient = useQueryClient()
  const requestedStatus = new URLSearchParams(window.location.search).get('status')
  const initialStatus = requestedStatus && ['NEW', 'IN_PROGRESS', 'CLOSED'].includes(requestedStatus) ? requestedStatus as LeadStatus : 'ALL'
  const [filter, setFilter] = useState<'ALL' | LeadStatus>(initialStatus)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('IN_PROGRESS')
  const leads = useQuery({ queryKey: ['admin', 'leads'], queryFn: () => api.request('/api/admin/leads', leadListResponseSchema) })
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru-RU')
    return leads.data?.leads.filter((lead) => (filter === 'ALL' || lead.status === filter) && (!needle || [lead.name, lead.phone, lead.email, lead.message, displayType(lead)].some((value) => value?.toLocaleLowerCase('ru-RU').includes(needle)))) ?? []
  }, [filter, leads.data, query])
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) => api.request(`/api/admin/leads/${id}/status`, leadResponseSchema, { method: 'PUT', body: updateLeadStatusRequestSchema.parse({ status }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] }),
  })
  const bulkUpdate = useMutation({
    mutationFn: () => api.request('/api/admin/workspace/bulk-status', adminBulkUpdateResponseSchema, { method: 'POST', body: adminBulkUpdateRequestSchema.parse({ resource: 'LEAD', ids: selectedIds, status: bulkStatus }) }),
    onSuccess: () => { setSelectedIds([]); void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] }) },
  })
  const toggle = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id])

  return <section className="admin-page">
    <AdminPageHeader
      eyebrow={hasPermission(user, 'LEADS_MANAGE') ? 'Обращения' : 'Подбор команды'}
      title={hasPermission(user, 'LEADS_MANAGE') ? 'Заявки с сайта' : 'Отклики на вакансии'}
      description={hasPermission(user, 'LEADS_MANAGE') ? 'Бронирования, банкеты, франшиза, регистрации и общая связь с гостями.' : 'Контакты кандидатов и движение откликов по рабочим статусам.'}
    />
    <AdminTabs label="Статус заявок" value={filter} onChange={setFilter} tabs={[{ value: 'ALL', label: 'Все', count: leads.data?.leads.length }, { value: 'NEW', label: 'Новые', count: leads.data?.leads.filter((lead) => lead.status === 'NEW').length }, { value: 'IN_PROGRESS', label: 'В работе', count: leads.data?.leads.filter((lead) => lead.status === 'IN_PROGRESS').length }, { value: 'CLOSED', label: 'Закрыты', count: leads.data?.leads.filter((lead) => lead.status === 'CLOSED').length }]} />
    <AdminListToolbar query={query} onQueryChange={setQuery} status={filter} onStatusChange={setFilter} statusOptions={[{ value: 'ALL', label: 'Все статусы' }, { value: 'NEW', label: 'Новые' }, { value: 'IN_PROGRESS', label: 'В работе' }, { value: 'CLOSED', label: 'Закрыты' }]} placeholder="Имя, телефон, сообщение…" />
    <AdminBulkBar count={selectedIds.length} action={bulkStatus} onActionChange={setBulkStatus} options={[{ value: 'NEW', label: 'Вернуть в новые' }, { value: 'IN_PROGRESS', label: 'Взять в работу' }, { value: 'CLOSED', label: 'Закрыть' }]} pending={bulkUpdate.isPending} onApply={() => bulkUpdate.mutate()} onClear={() => setSelectedIds([])} />
    {leads.isPending && <p className="admin-state-message">Загружаем заявки…</p>}
    {leads.isError && <p className="admin-state-message admin-state-error">Не удалось загрузить заявки. Проверьте доступ и повторите попытку.</p>}
    {!leads.isPending && !leads.isError && visible.length === 0 && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Здесь появятся обращения с сайта.</CardContent></Card>}
    {visible.length > 0 ? <Card className="admin-leads-list"><CardContent>{visible.map((lead) => { const metadata = displayMetadata(lead); return <article key={lead.id} className="admin-lead-row"><input aria-label={`Выбрать заявку ${lead.name}`} checked={selectedIds.includes(lead.id)} type="checkbox" onChange={() => toggle(lead.id)} /><div><p className="text-sm font-semibold">{displayType(lead)}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleString('ru-RU')}</p></div><div className="min-w-0"><h2 className="font-semibold">{lead.name}</h2><p className="mt-1 text-sm text-muted-foreground">{[lead.phone, lead.email].filter(Boolean).join(' · ') || 'Контакты не указаны'}</p>{lead.message && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6">{lead.message}</p>}{metadata.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{metadata.map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}</div><label className="admin-field h-fit"><span className="admin-field-label">Статус</span><select disabled={update.isPending} value={lead.status} onChange={(event) => update.mutate({ id: lead.id, status: event.target.value as LeadStatus })}>{(['NEW', 'IN_PROGRESS', 'CLOSED'] as const).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label></article> })}</CardContent></Card> : null}
    {update.isError && <p className="admin-state-message admin-state-error">Не удалось обновить статус заявки.</p>}
    {bulkUpdate.isError && <p className="admin-state-message admin-state-error">Не удалось обновить выбранные заявки.</p>}
  </section>
}
