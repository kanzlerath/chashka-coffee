import {
  adminOrderListResponseSchema,
  orderResponseSchema,
  updateOrderStatusRequestSchema,
  type Order,
  type OrderStatus,
} from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { AdminListToolbar, AdminPageHeader, AdminTabs } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/features/auth'

const statusLabel: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Ожидает оплаты',
  PAID: 'Оплачен',
  PREPARING: 'Готовится',
  READY_FOR_PICKUP: 'Готов к выдаче',
  COMPLETED: 'Выдан',
  CANCELLED: 'Отменён',
}

const nextStatuses: Record<OrderStatus, readonly OrderStatus[]> = {
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function OrdersPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'ALL' | OrderStatus>('ALL')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const orders = useQuery({ queryKey: ['admin', 'orders'], queryFn: () => api.request('/api/admin/orders', adminOrderListResponseSchema) })
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => api.request(`/api/admin/orders/${id}/status`, orderResponseSchema, { method: 'PUT', body: updateOrderStatusRequestSchema.parse({ status }) }),
    onSuccess: ({ order }) => {
      queryClient.setQueryData(['admin', 'orders'], (current: typeof orders.data) => current ? { orders: current.orders.map((item) => item.id === order.id ? order : item) } : current)
    },
  })
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru-RU')
    return orders.data?.orders.filter((order) => {
      if (status !== 'ALL' && order.status !== status) return false
      return !needle || [order.publicNumber, order.customer.name, order.customer.phone, order.pickupLocation.name, order.pickupLocation.address]
        .some((value) => value.toLocaleLowerCase('ru-RU').includes(needle))
    }) ?? []
  }, [orders.data, query, status])

  return <section className="admin-page">
    <AdminPageHeader eyebrow="Самовывоз" title="Заказы кофе" description="Оплата, сборка и выдача онлайн-заказов по выбранным ресторанам." />
    <AdminTabs label="Статус заказов" value={status} onChange={setStatus} tabs={[
      { value: 'ALL', label: 'Все', count: orders.data?.orders.length },
      { value: 'AWAITING_PAYMENT', label: 'Ждут оплаты', count: count(orders.data?.orders, 'AWAITING_PAYMENT') },
      { value: 'PAID', label: 'Оплачены', count: count(orders.data?.orders, 'PAID') },
      { value: 'PREPARING', label: 'Готовятся', count: count(orders.data?.orders, 'PREPARING') },
      { value: 'READY_FOR_PICKUP', label: 'К выдаче', count: count(orders.data?.orders, 'READY_FOR_PICKUP') },
    ]} />
    <AdminListToolbar query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} statusOptions={[
      { value: 'ALL', label: 'Все статусы' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value: value as OrderStatus, label })),
    ]} placeholder="Номер, гость, телефон, точка…" />
    {orders.isPending ? <p className="admin-state-message">Загружаем заказы…</p> : null}
    {orders.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить заказы.</p> : null}
    {!orders.isPending && visible.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Заказов с такими параметрами пока нет.</CardContent></Card> : null}
    <div className="grid gap-2">
      {visible.map((order) => <OrderRow key={order.id} order={order} open={openId === order.id} pending={update.isPending} onToggle={() => setOpenId((value) => value === order.id ? null : order.id)} onStatus={(nextStatus) => update.mutate({ id: order.id, status: nextStatus })} />)}
    </div>
    {update.isError ? <p className="admin-state-message admin-state-error">Статус не изменён. Обновите список и проверьте текущий этап заказа.</p> : null}
  </section>
}

function OrderRow({ order, open, pending, onToggle, onStatus }: { order: Order; open: boolean; pending: boolean; onToggle: () => void; onStatus: (status: OrderStatus) => void }) {
  return <Card className="overflow-hidden">
    <button className="grid w-full grid-cols-[minmax(145px,.6fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto] items-center gap-5 p-5 text-left hover:bg-muted/40 max-lg:grid-cols-2" type="button" aria-expanded={open} onClick={onToggle}>
      <span><strong className="block text-sm">{order.publicNumber}</strong><small className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString('ru-RU')}</small></span>
      <span><strong className="block text-sm">{order.customer.name}</strong><small className="text-xs text-muted-foreground">{order.customer.phone}</small></span>
      <span><strong className="block text-sm">{shortLocation(order.pickupLocation.name)}</strong><small className="text-xs text-muted-foreground">{order.pickupLocation.address}</small></span>
      <span className="flex items-center justify-end gap-4"><b className="text-sm">{money(order.totalKopecks)}</b><i className={`admin-status admin-status-${statusTone(order.status)}`}>{statusLabel[order.status]}</i></span>
    </button>
    {open ? <CardContent className="grid gap-6 border-t bg-muted/20 p-6 lg:grid-cols-[1fr_320px]">
      <div><h2 className="mb-3 text-sm font-semibold">Состав заказа</h2><div className="divide-y">{order.items.map((item) => <div className="flex items-center justify-between gap-4 py-3" key={item.id}><span><strong className="block text-sm">{item.productName}</strong><small className="text-xs text-muted-foreground">{item.variantLabel} · {item.quantity} шт.</small></span><b className="text-sm">{money(item.totalKopecks)}</b></div>)}</div>{order.comment ? <div className="mt-5 rounded-lg border p-3"><small className="text-muted-foreground">Комментарий гостя</small><p className="mt-1 text-sm">{order.comment}</p></div> : null}</div>
      <aside className="grid content-start gap-4"><div><small className="text-muted-foreground">Контакты</small><p className="mt-1 text-sm font-medium">{order.customer.phone}{order.customer.email ? ` · ${order.customer.email}` : ''}</p></div><div><small className="text-muted-foreground">Оплата</small><p className="mt-1 text-sm font-medium">{order.paymentStatus === 'PAID' ? 'Оплачено' : 'Ожидается'}</p></div><div className="flex flex-wrap gap-2">{nextStatuses[order.status].map((next) => <Button disabled={pending} key={next} size="sm" variant={next === 'CANCELLED' ? 'outline' : 'default'} onClick={() => onStatus(next)}>{next === 'CANCELLED' ? 'Отменить' : statusLabel[next]}</Button>)}</div>{nextStatuses[order.status].length === 0 ? <p className="text-xs text-muted-foreground">Заказ завершён, дальнейших действий нет.</p> : null}</aside>
    </CardContent> : null}
  </Card>
}

function count(orders: Order[] | undefined, status: OrderStatus) { return orders?.filter((order) => order.status === status).length }
function money(kopecks: number) { return `${(kopecks / 100).toLocaleString('ru-RU')} ₽` }
function shortLocation(value: string) { return value.replace(/^Чашка кофе\s*[—-]\s*/i, '') }
function statusTone(status: OrderStatus) { return status === 'CANCELLED' ? 'archived' : status === 'COMPLETED' ? 'published' : status === 'AWAITING_PAYMENT' ? 'draft' : 'scheduled' }
