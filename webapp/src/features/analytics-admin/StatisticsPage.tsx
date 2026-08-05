import { analyticsSummaryResponseSchema, crmAnalyticsResponseSchema } from '@chashka-coffee/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth'

const periods = [7, 30, 90] as const

export function StatisticsPage() {
  const { api } = useAuth()
  const [days, setDays] = useState<(typeof periods)[number]>(30)
  const [view, setView] = useState<'SALES' | 'SITE'>('SALES')
  const summary = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => api.request(`/api/admin/analytics?days=${days}`, analyticsSummaryResponseSchema),
  })
  const crmSummary = useQuery({
    queryKey: ['admin', 'crm-analytics', days],
    queryFn: () => api.request(`/api/admin/crm-analytics?days=${days}`, crmAnalyticsResponseSchema),
  })

  const maxViews = Math.max(1, ...(summary.data?.daily.map((point) => point.views) ?? [1]))

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow="Аналитика"
        title={view === 'SALES' ? 'Продажи кофе' : 'Статистика сайта'}
        description={view === 'SALES' ? 'Выручка и клиентские показатели рассчитаны только по онлайн-заказам кофе.' : 'Обезличенные просмотры помогают понять, какие страницы действительно нужны гостям. Имена, телефоны и IP-адреса здесь не собираются.'}
        actions={(
          <div className="admin-period-switch" aria-label="Период статистики">
            {periods.map((period) => (
              <Button key={period} size="sm" type="button" variant={period === days ? 'default' : 'outline'} onClick={() => setDays(period)}>
                {period} дней
              </Button>
            ))}
          </div>
        )}
      />

      <div className="mb-5 flex gap-2 border-b pb-4">
        <Button size="sm" variant={view === 'SALES' ? 'default' : 'ghost'} onClick={() => setView('SALES')}>Продажи и клиенты</Button>
        <Button size="sm" variant={view === 'SITE' ? 'default' : 'ghost'} onClick={() => setView('SITE')}>Посещаемость сайта</Button>
      </div>

      {view === 'SALES' && crmSummary.isPending ? <p className="admin-state-message">Собираем показатели продаж…</p> : null}
      {view === 'SALES' && crmSummary.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить показатели продаж.</p> : null}
      {view === 'SALES' && crmSummary.data ? <SalesAnalytics data={crmSummary.data} /> : null}

      {view === 'SITE' && summary.isPending ? <p className="admin-state-message">Собираем статистику…</p> : null}
      {view === 'SITE' && summary.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить статистику. Проверьте API и применена ли последняя миграция базы.</p> : null}
      {view === 'SITE' && summary.data ? (
        <>
          <div className="admin-metric-strip">
            <Metric value={summary.data.overview.views} label={`Просмотров за ${days} дней`} />
            <Metric value={summary.data.overview.visitors} label="Уникальных посетителей" />
            <Metric value={summary.data.overview.todayViews} label="Просмотров сегодня" />
            <Metric value={summary.data.overview.newLeads} label="Новых заявок" />
          </div>

          <div className="admin-analytics-grid">
            <Card className="admin-analytics-chart">
              <CardHeader>
                <CardTitle>Динамика просмотров</CardTitle>
                <CardDescription>Столбец — один день. Наведите курсор, чтобы увидеть точное значение.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="admin-chart-bars" role="img" aria-label="Просмотры сайта по дням">
                  {summary.data.daily.map((point) => (
                    <div className="admin-chart-day" key={point.date} title={`${formatDate(point.date)}: ${point.views} просмотров, ${point.visitors} посетителей`}>
                      <span style={{ height: `${Math.max(4, (point.views / maxViews) * 100)}%` }} />
                      <small>{new Date(`${point.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</small>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Популярные страницы</CardTitle>
                <CardDescription>Куда гости заходят чаще всего.</CardDescription>
              </CardHeader>
              <CardContent className="admin-ranked-list">
                {summary.data.topPages.length ? summary.data.topPages.map((page, index) => (
                  <div key={page.path}>
                    <span>{index + 1}</span>
                    <p><strong>{pageName(page.path)}</strong><small>{page.path}</small></p>
                    <b>{page.views}</b>
                  </div>
                )) : <p className="admin-empty-copy">Просмотры появятся после посещения публичного сайта.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Последние посещения</CardTitle>
              <CardDescription>Анонимный идентификатор позволяет отличать посетителей, не раскрывая их личность.</CardDescription>
            </CardHeader>
            <CardContent className="admin-table-wrap">
              <table className="admin-data-table">
                <thead><tr><th>Время</th><th>Страница</th><th>Посетитель</th><th>Устройство</th></tr></thead>
                <tbody>{summary.data.recent.map((view) => (
                  <tr key={view.id}>
                    <td>{new Date(view.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>{pageName(view.path)}</strong><small>{view.path}</small></td>
                    <td><code>{view.visitorId.slice(0, 8)}</code></td>
                    <td>{deviceLabel[view.device]}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  )
}

function SalesAnalytics({ data }: { data: import('@chashka-coffee/contracts').CrmAnalyticsResponse }) {
  const maxRevenue = Math.max(1, ...data.daily.map((point) => point.revenueKopecks))
  return <>
    <div className="admin-metric-strip">
      <SalesMetric value={money(data.overview.revenueKopecks)} label={`Выручка за ${data.periodDays} дней`} previous={percentChange(data.overview.revenueKopecks, data.previous.revenueKopecks)} />
      <SalesMetric value={data.overview.paidOrders.toLocaleString('ru-RU')} label="Оплаченных заказов" previous={percentChange(data.overview.paidOrders, data.previous.paidOrders)} />
      <SalesMetric value={money(data.overview.averageCheckKopecks)} label="Средний чек" />
      <SalesMetric value={`${data.overview.repeatRatePercent.toLocaleString('ru-RU')}%`} label="Повторные клиенты" />
    </div>
    <div className="mt-3 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
      <div className="bg-background px-5 py-4"><strong className="block text-xl">{data.overview.newCustomers}</strong><span className="text-xs text-muted-foreground">Новых покупателей</span></div>
      <div className="bg-background px-5 py-4"><strong className="block text-xl">{data.overview.returningCustomers}</strong><span className="text-xs text-muted-foreground">Вернувшихся покупателей</span></div>
      <div className="bg-background px-5 py-4"><strong className="block text-xl">{data.overview.cancelledOrders}</strong><span className="text-xs text-muted-foreground">Отменённых заказов</span></div>
    </div>
    <div className="admin-analytics-grid mt-6">
      <Card className="admin-analytics-chart">
        <CardHeader><CardTitle>Выручка по дням</CardTitle><CardDescription>Только оплаченные онлайн-заказы.</CardDescription></CardHeader>
        <CardContent><div className="admin-chart-bars" role="img" aria-label="Выручка онлайн-заказов по дням">{data.daily.map((point) => <div className="admin-chart-day" key={point.date} title={`${formatDate(point.date)}: ${money(point.revenueKopecks)}, ${point.paidOrders} заказов`}><span style={{ height: `${Math.max(4, (point.revenueKopecks / maxRevenue) * 100)}%` }} /><small>{new Date(`${point.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</small></div>)}</div></CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Лидеры продаж</CardTitle><CardDescription>Товары по выручке за выбранный период.</CardDescription></CardHeader><CardContent className="admin-ranked-list">{data.topProducts.length ? data.topProducts.map((product, index) => <div key={product.name}><span>{index + 1}</span><p><strong>{product.name}</strong><small>{product.quantity} шт.</small></p><b>{money(product.revenueKopecks)}</b></div>) : <p className="admin-empty-copy">Оплаченных заказов за период пока нет.</p>}</CardContent></Card>
    </div>
    <Card className="mt-6"><CardHeader><CardTitle>Точки самовывоза</CardTitle><CardDescription>Вклад ресторанов в онлайн-продажи кофе.</CardDescription></CardHeader><CardContent className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>Ресторан</th><th>Оплачено заказов</th><th>Выручка</th></tr></thead><tbody>{data.topPickupLocations.map((location) => <tr key={location.name}><td><strong>{location.name}</strong></td><td>{location.paidOrders}</td><td>{money(location.revenueKopecks)}</td></tr>)}</tbody></table></CardContent></Card>
  </>
}

function SalesMetric({ value, label, previous }: { value: string; label: string; previous?: string }) { return <div><strong>{value}</strong><span>{label}{previous ? ` · ${previous}` : ''}</span></div> }
function money(kopecks: number) { return `${(kopecks / 100).toLocaleString('ru-RU')} ₽` }
function percentChange(current: number, previous: number) { if (!previous) return current ? 'новое' : 'без изменений'; const value = Math.round(((current - previous) / previous) * 100); return `${value > 0 ? '+' : ''}${value}% к прошлому периоду` }

function Metric({ value, label }: { value: number; label: string }) {
  return <div><strong>{value.toLocaleString('ru-RU')}</strong><span>{label}</span></div>
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function pageName(path: string) {
  const names: Record<string, string> = { '/': 'Главная', '/menu': 'Меню', '/restaurants': 'Рестораны', '/coffee': 'Кофе для дома', '/contacts': 'Контакты', '/promotions': 'Акции', '/events': 'События', '/journal': 'Журнал' }
  return names[path] ?? path.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') ?? 'Страница'
}

const deviceLabel = { DESKTOP: 'Компьютер', TABLET: 'Планшет', MOBILE: 'Телефон' } as const
