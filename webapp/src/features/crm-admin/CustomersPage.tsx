import {
  createCrmCustomerNoteRequestSchema,
  createCrmTagRequestSchema,
  crmCustomerListResponseSchema,
  crmCustomerNoteResponseSchema,
  crmCustomerResponseSchema,
  crmTagListResponseSchema,
  crmTagResponseSchema,
  setCrmCustomerTagsRequestSchema,
  updateCrmCustomerRequestSchema,
  type CrmCustomerDetail,
  type CrmCustomerSegment,
  type CrmCustomerSort,
} from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AdminPageHeader } from '@/components/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'

const segmentOptions: Array<{ value: CrmCustomerSegment; label: string }> = [
  { value: 'ALL', label: 'Все' }, { value: 'NEW', label: 'Новые' }, { value: 'REPEAT', label: 'Повторные' },
  { value: 'VIP', label: 'VIP' }, { value: 'INACTIVE_30', label: 'Без покупки 30 дней' }, { value: 'INACTIVE_90', label: 'Без покупки 90 дней' },
]
const sortOptions: Array<{ value: CrmCustomerSort; label: string }> = [
  { value: 'LAST_ORDER_DESC', label: 'Последняя покупка' }, { value: 'TOTAL_SPENT_DESC', label: 'Сумма покупок' },
  { value: 'ORDER_COUNT_DESC', label: 'Количество заказов' }, { value: 'NEWEST_DESC', label: 'Недавно добавленные' },
]

export function CustomersPage() {
  const { api } = useAuth()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState<CrmCustomerSegment>('ALL')
  const [sort, setSort] = useState<CrmCustomerSort>('LAST_ORDER_DESC')
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ page: String(page), pageSize: '25', segment, sort })
  if (query.trim()) params.set('q', query.trim())
  const customers = useQuery({
    queryKey: ['admin', 'crm-customers', query.trim(), segment, sort, page],
    queryFn: () => api.request(`/api/admin/customers?${params}`, crmCustomerListResponseSchema),
  })
  const totalPages = Math.max(1, Math.ceil((customers.data?.total ?? 0) / 25))

  function changeSegment(value: CrmCustomerSegment) { setSegment(value); setPage(1) }

  return <section className="admin-page">
    <AdminPageHeader eyebrow="Онлайн-продажи кофе" title="Клиенты" description="Покупатели объединяются по подтверждённому номеру телефона. Офлайн-история PremiumBonus пока не входит в показатели." />

    <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
      <SummaryCell label="Клиентов в выборке" value={customers.data?.total} />
      <SummaryCell label="Сегмент" value={segmentOptions.find((item) => item.value === segment)?.label ?? 'Все'} />
      <SummaryCell label="Источник" value="Онлайн-заказы" />
    </div>

    <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto] xl:items-center">
      <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Имя, телефон или e-mail…" aria-label="Поиск клиентов" />
      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={sort} onChange={(event) => setSort(event.target.value as CrmCustomerSort)} aria-label="Сортировка клиентов">
        {sortOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
      </select>
    </div>

    <div className="mt-3 flex flex-wrap gap-2" aria-label="Сегменты клиентов">
      {segmentOptions.map((item) => <Button key={item.value} size="sm" variant={segment === item.value ? 'default' : 'outline'} onClick={() => changeSegment(item.value)}>{item.label}</Button>)}
    </div>

    <div className="mt-6 overflow-hidden rounded-xl border bg-background">
      <div className="grid grid-cols-[minmax(240px,1.4fr)_130px_140px_160px] gap-5 border-b bg-muted/35 px-5 py-3 text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground max-lg:hidden">
        <span>Клиент</span><span>Заказы</span><span>Потрачено</span><span>Последняя покупка</span>
      </div>
      {customers.isPending ? <p className="admin-state-message">Собираем клиентскую базу…</p> : null}
      {customers.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить клиентов.</p> : null}
      {customers.data?.customers.map((customer) => (
        <Link to="/customers/$customerId" params={{ customerId: customer.id }} key={customer.id} className="group grid grid-cols-[minmax(240px,1.4fr)_130px_140px_160px] items-center gap-5 border-b px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/35 max-lg:grid-cols-2">
          <span className="min-w-0">
            <strong className="block truncate text-sm">{customer.name}</strong>
            <small className="mt-0.5 block text-xs text-muted-foreground">{formatPhone(customer.phone)}{customer.email ? ` · ${customer.email}` : ''}</small>
            {customer.tags.length ? <span className="mt-2 flex flex-wrap gap-1">{customer.tags.map((tag) => <Tag key={tag.id} name={tag.name} color={tag.color} />)}</span> : null}
          </span>
          <MetricValue value={String(customer.metrics.paidOrderCount)} label="оплачено" />
          <MetricValue value={money(customer.metrics.totalSpentKopecks)} label={`средний ${money(customer.metrics.averageCheckKopecks)}`} />
          <MetricValue value={customer.metrics.lastOrderAt ? shortDate(customer.metrics.lastOrderAt) : '—'} label="последняя" />
        </Link>
      ))}
      {!customers.isPending && customers.data?.customers.length === 0 ? <p className="px-5 py-16 text-center text-sm text-muted-foreground">В этом сегменте клиентов пока нет.</p> : null}
    </div>

    {totalPages > 1 ? <div className="mt-4 flex items-center justify-between gap-3"><small className="text-muted-foreground">Страница {page} из {totalPages}</small><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</Button><Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Дальше</Button></div></div> : null}
  </section>
}

export function CustomerDetailPage({ customerId }: { customerId: string }) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const customer = useQuery({ queryKey: ['admin', 'crm-customer', customerId], queryFn: () => api.request(`/api/admin/customers/${customerId}`, crmCustomerResponseSchema) })
  const tags = useQuery({ queryKey: ['admin', 'crm-tags'], queryFn: () => api.request('/api/admin/customer-tags', crmTagListResponseSchema) })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const data = customer.data?.customer

  useEffect(() => {
    if (!data) return
    setName(data.name); setEmail(data.email ?? ''); setSelectedTags(data.tags.map((tag) => tag.id))
  }, [data])

  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'crm-customer', customerId] }); await queryClient.invalidateQueries({ queryKey: ['admin', 'crm-customers'] }) }
  const updateCustomer = useMutation({
    mutationFn: () => api.request(`/api/admin/customers/${customerId}`, crmCustomerResponseSchema, { method: 'PUT', body: updateCrmCustomerRequestSchema.parse({ name, email, status: data?.status ?? 'ACTIVE' }) }),
    onSuccess: async () => { setEditing(false); await refresh() },
  })
  const addNote = useMutation({
    mutationFn: () => api.request(`/api/admin/customers/${customerId}/notes`, crmCustomerNoteResponseSchema, { method: 'POST', body: createCrmCustomerNoteRequestSchema.parse({ body: note }) }),
    onSuccess: async () => { setNote(''); await refresh() },
  })
  const saveTags = useMutation({
    mutationFn: (tagIds: string[]) => api.request(`/api/admin/customers/${customerId}/tags`, crmCustomerResponseSchema, { method: 'PUT', body: setCrmCustomerTagsRequestSchema.parse({ tagIds }) }),
    onSuccess: async () => refresh(),
  })
  const createTag = useMutation({
    mutationFn: () => api.request('/api/admin/customer-tags', crmTagResponseSchema, { method: 'POST', body: createCrmTagRequestSchema.parse({ name: newTag, color: null }) }),
    onSuccess: async ({ tag }) => { setNewTag(''); await queryClient.invalidateQueries({ queryKey: ['admin', 'crm-tags'] }); const next = [...selectedTags, tag.id]; setSelectedTags(next); saveTags.mutate(next) },
  })
  const archive = useMutation({
    mutationFn: () => api.request(`/api/admin/customers/${customerId}`, crmCustomerResponseSchema, { method: 'PUT', body: updateCrmCustomerRequestSchema.parse({ name: data?.name, email: data?.email, status: data?.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' }) }),
    onSuccess: async () => refresh(),
  })

  if (customer.isPending) return <section className="admin-page"><p className="admin-state-message">Открываем карточку клиента…</p></section>
  if (!data || customer.isError) return <section className="admin-page"><AdminPageHeader title="Клиент не найден" actions={<Button asChild variant="outline"><Link to="/customers">К списку</Link></Button>} /></section>

  const timeline = buildTimeline(data)
  return <section className="admin-page">
    <AdminPageHeader eyebrow="Карточка клиента" title={data.name} description={`${formatPhone(data.phone)}${data.email ? ` · ${data.email}` : ''}`} actions={<div className="flex gap-2"><Button asChild variant="outline"><Link to="/customers">К списку</Link></Button><Button variant="outline" onClick={() => setEditing((value) => !value)}>Изменить</Button></div>} />

    <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCell label="Оплаченных заказов" value={data.metrics.paidOrderCount} />
      <SummaryCell label="Выручка" value={money(data.metrics.totalSpentKopecks)} />
      <SummaryCell label="Средний чек" value={money(data.metrics.averageCheckKopecks)} />
      <SummaryCell label="Последняя покупка" value={data.metrics.lastOrderAt ? shortDate(data.metrics.lastOrderAt) : '—'} />
    </div>

    {editing ? <Card className="mt-6"><CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="grid gap-1.5 text-sm"><span className="font-medium">Имя</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">E-mail</span><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><Button disabled={updateCustomer.isPending} onClick={() => updateCustomer.mutate()}>Сохранить</Button></CardContent></Card> : null}

    <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
      <div>
        <SectionTitle title="История клиента" note="Заказы и обращения в одной хронологии" />
        <div className="border-t">
          {timeline.map((entry) => entry.kind === 'order' ? <OrderTimelineRow key={`order-${entry.value.id}`} order={entry.value} /> : <LeadTimelineRow key={`lead-${entry.value.id}`} lead={entry.value} />)}
          {!timeline.length ? <p className="py-12 text-sm text-muted-foreground">Событий пока нет.</p> : null}
        </div>
      </div>

      <aside className="grid content-start gap-7">
        <section>
          <SectionTitle title="Коммуникации" note="Готовность к отправке" />
          <div className="grid gap-2 border-t pt-3">
            <CommunicationRow label="Push" enabled={data.consents.some((consent) => consent.channel === 'PUSH' && consent.status === 'GRANTED')} detail={data.activePushSubscriptions ? `${data.activePushSubscriptions} активн. устройств` : 'Нет зарегистрированных устройств'} />
            <CommunicationRow label="E-mail" enabled={data.consents.some((consent) => consent.channel === 'EMAIL' && consent.status === 'GRANTED')} detail={data.email ?? 'E-mail не указан'} />
            <CommunicationRow label="SMS" enabled={data.consents.some((consent) => consent.channel === 'SMS' && consent.status === 'GRANTED')} detail={formatPhone(data.phone)} />
          </div>
        </section>

        <section>
          <SectionTitle title="Теги" note="Ручные признаки клиента" />
          <div className="grid gap-2 border-t pt-3">
            {tags.data?.tags.map((tag) => <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm" key={tag.id}><span className="flex items-center gap-2"><Checkbox checked={selectedTags.includes(tag.id)} onCheckedChange={(checked) => { const next = checked ? [...selectedTags, tag.id] : selectedTags.filter((id) => id !== tag.id); setSelectedTags(next); saveTags.mutate(next) }} /><Tag name={tag.name} color={tag.color} /></span></label>)}
            <div className="mt-2 flex gap-2"><Input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Новый тег" /><Button size="sm" variant="outline" disabled={!newTag.trim() || createTag.isPending} onClick={() => createTag.mutate()}>Создать</Button></div>
          </div>
        </section>

        <section>
          <SectionTitle title="Заметки" note="Видны только сотрудникам CRM" />
          <div className="grid gap-2 border-t pt-3"><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Предпочтения, договорённости, важный контекст…" /><Button disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>Добавить заметку</Button></div>
          <div className="mt-3 divide-y">{data.notes.map((item) => <div className="py-3" key={item.id}><p className="whitespace-pre-wrap text-sm">{item.body}</p><small className="mt-1 block text-xs text-muted-foreground">{item.author?.displayName ?? item.author?.email ?? 'Удалённый сотрудник'} · {shortDateTime(item.createdAt)}</small></div>)}</div>
        </section>

        <section className="border-t pt-5">
          <p className="text-xs text-muted-foreground">Статус: {data.status === 'ACTIVE' ? 'активный клиент' : 'в архиве'}</p>
          <Button className="mt-3" size="sm" variant="ghost" disabled={archive.isPending} onClick={() => archive.mutate()}>{data.status === 'ACTIVE' ? 'Переместить в архив' : 'Вернуть в активные'}</Button>
        </section>
      </aside>
    </div>
  </section>
}

function SummaryCell({ label, value }: { label: string; value: string | number | undefined }) { return <div className="bg-background px-5 py-4"><strong className="block text-xl tracking-tight">{value ?? '—'}</strong><span className="mt-1 block text-xs text-muted-foreground">{label}</span></div> }
function MetricValue({ value, label }: { value: string; label: string }) { return <span><strong className="block text-sm">{value}</strong><small className="text-xs text-muted-foreground">{label}</small></span> }
function SectionTitle({ title, note }: { title: string; note: string }) { return <div className="mb-3 flex items-baseline justify-between gap-4"><h2 className="text-sm font-semibold">{title}</h2><span className="text-xs text-muted-foreground">{note}</span></div> }
function CommunicationRow({ label, enabled, detail }: { label: string; enabled: boolean; detail: string }) { return <div className="flex items-center justify-between gap-4 py-1"><span><strong className="block text-sm">{label}</strong><small className="text-xs text-muted-foreground">{detail}</small></span><Badge variant={enabled ? 'secondary' : 'outline'}>{enabled ? 'Согласие есть' : 'Нет согласия'}</Badge></div> }
function Tag({ name, color }: { name: string; color: string | null }) { return <Badge variant="outline" style={color ? { borderColor: color, color } : undefined}>{name}</Badge> }

function OrderTimelineRow({ order }: { order: CrmCustomerDetail['orders'][number] }) { return <div className="grid gap-3 border-b py-4 sm:grid-cols-[110px_1fr_auto]"><time className="text-xs text-muted-foreground">{shortDateTime(order.createdAt)}</time><span><strong className="block text-sm">Заказ {order.publicNumber}</strong><small className="text-xs text-muted-foreground">{order.items.map((item) => `${item.productName} · ${item.quantity}`).join(', ')}<br />{order.pickupLocation.name}</small></span><span className="text-right"><strong className="block text-sm">{money(order.totalKopecks)}</strong><small className="text-xs text-muted-foreground">{order.paymentStatus === 'PAID' ? 'Оплачен' : 'Не оплачен'}</small></span></div> }
function LeadTimelineRow({ lead }: { lead: CrmCustomerDetail['leads'][number] }) { return <div className="grid gap-3 border-b py-4 sm:grid-cols-[110px_1fr_auto]"><time className="text-xs text-muted-foreground">{shortDateTime(lead.createdAt)}</time><span><strong className="block text-sm">Обращение · {leadTypeLabel[lead.type]}</strong><small className="text-xs text-muted-foreground">{lead.message ?? 'Без сообщения'}</small></span><Badge variant="secondary">{lead.status === 'NEW' ? 'Новое' : lead.status === 'IN_PROGRESS' ? 'В работе' : 'Закрыто'}</Badge></div> }

function buildTimeline(customer: CrmCustomerDetail) {
  return [
    ...customer.orders.map((value) => ({ kind: 'order' as const, date: value.createdAt, value })),
    ...customer.leads.map((value) => ({ kind: 'lead' as const, date: value.createdAt, value })),
  ].sort((left, right) => right.date.localeCompare(left.date))
}

const leadTypeLabel = { CONTACT: 'вопрос', RESERVATION: 'бронь', FRANCHISE: 'франшиза', BANQUET: 'банкет', JOB: 'вакансия', EVENT_REGISTRATION: 'событие' } as const
function money(kopecks: number) { return `${(kopecks / 100).toLocaleString('ru-RU')} ₽` }
function shortDate(value: string) { return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) }
function shortDateTime(value: string) { return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function formatPhone(phone: string) { return phone.length === 11 && phone.startsWith('7') ? `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}` : phone }
