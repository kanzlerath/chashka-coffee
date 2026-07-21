import { analyticsSummaryResponseSchema } from '@chashka-coffee/contracts'
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
  const summary = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => api.request(`/api/admin/analytics?days=${days}`, analyticsSummaryResponseSchema),
  })

  const maxViews = Math.max(1, ...(summary.data?.daily.map((point) => point.views) ?? [1]))

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow="Аналитика"
        title="Статистика сайта"
        description="Обезличенные просмотры помогают понять, какие страницы действительно нужны гостям. Имена, телефоны и IP-адреса здесь не собираются."
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

      {summary.isPending ? <p className="admin-state-message">Собираем статистику…</p> : null}
      {summary.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить статистику. Проверьте API и применена ли последняя миграция базы.</p> : null}
      {summary.data ? (
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
