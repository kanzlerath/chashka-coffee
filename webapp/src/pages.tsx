import {
  Analytics01Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  CakeSliceIcon,
  Calendar03Icon,
  Cancel01Icon,
  Clock01Icon,
  Coffee02Icon,
  DashboardSquare01Icon,
  File01Icon,
  Home01Icon,
  Image01Icon,
  InboxIcon,
  Logout01Icon,
  Megaphone01Icon,
  Menu01Icon,
  MenuRestaurantIcon,
  News01Icon,
  RestaurantIcon,
  Settings01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { adminWorkspaceResponseSchema, analyticsSummaryResponseSchema, hasPermission, type AuditEvent, type UserRole } from '@chashka-coffee/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { AdminCommandMenu, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { AuthForm, useAuth } from '@/features/auth'
import { MenuPage, RestaurantsPage } from '@/features/catalog-admin'
import { ContentPage } from '@/features/content-admin'
import { HomepagePage } from '@/features/homepage-admin'
import { JobsPage } from '@/features/jobs-admin'
import { LeadsPage } from '@/features/leads-admin'
import { MediaPage } from '@/features/media-admin'
import { ManagedPagesPage } from '@/features/pages-admin'
import { ProductsPage } from '@/features/products-admin'
import { TeamPage } from '@/features/staff-admin'
import { StatisticsPage } from '@/features/analytics-admin'
import { ActivityPage } from '@/features/workspace-admin'
import { OrdersPage } from '@/features/orders-admin'
import { CustomerDetailPage, CustomersPage } from '@/features/crm-admin'
import { TelegramNotificationsPage } from '@/features/telegram-notifications-admin'
import { SharedHeaderPage } from '@/features/site-settings-admin'

const workspaceNavigation = [
  { to: '/', label: 'Обзор', icon: DashboardSquare01Icon },
  { to: '/orders', label: 'Заказы', icon: Coffee02Icon, permission: 'ORDERS_MANAGE' },
  { to: '/customers', label: 'Клиенты', icon: UserGroupIcon, permission: 'CUSTOMERS_READ' },
] as const

const catalogNavigation = [
  { to: '/restaurants', label: 'Рестораны', icon: RestaurantIcon, permission: 'CATALOG_MANAGE' },
  { to: '/menus', label: 'Меню', icon: MenuRestaurantIcon, permission: 'CATALOG_MANAGE' },
  { to: '/products/coffee', label: 'Кофе', icon: Coffee02Icon, permission: 'CATALOG_MANAGE' },
  { to: '/products/cakes', label: 'Торты', icon: CakeSliceIcon, permission: 'CATALOG_MANAGE' },
] as const

const pageNavigation = [
  { to: '/homepage', label: 'Главная', icon: Home01Icon, permission: 'CONTENT_MANAGE' },
  { to: '/pages', label: 'Страницы', icon: File01Icon, permission: 'CONTENT_MANAGE' },
] as const

const publicationNavigation = [
  { to: '/content/promotions', label: 'Акции', icon: Megaphone01Icon, permission: 'CONTENT_MANAGE' },
  { to: '/content/events', label: 'События', icon: Calendar03Icon, permission: 'CONTENT_MANAGE' },
  { to: '/content/journal', label: 'Журнал', icon: News01Icon, permission: 'CONTENT_MANAGE' },
  { to: '/jobs', label: 'Вакансии', icon: Briefcase01Icon, permission: 'JOBS_MANAGE' },
] as const

const roleLabel: Record<UserRole, string> = {
  SUPER_ADMIN: 'Суперадмин', CONTENT_MANAGER: 'Контент-мейкер', CATALOG_MANAGER: 'Ответственный за меню',
  ORDER_OPERATOR: 'Оператор заказов', LEAD_OPERATOR: 'Оператор заявок', RECRUITER: 'Рекрутер',
}

export function RootLayout() {
  const auth = useAuth()
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)

  if (!auth.user) {
    return (
      <main className="admin-auth-shell">
        <Outlet />
      </main>
    )
  }

  const closeNavigation = () => setIsNavigationOpen(false)

  return (
    <main className="admin-shell">
      <header className="admin-mobile-header">
        <Link to="/" className="admin-brand" aria-label="Админка Чашка кофе — обзор" onClick={closeNavigation}>
          <span className="admin-brand-mark">ЧК</span>
          <span>
            <strong>Чашка кофе</strong>
            <small>Управление сайтом</small>
          </span>
        </Link>
        <Button
          aria-expanded={isNavigationOpen}
          aria-label={isNavigationOpen ? 'Закрыть меню' : 'Открыть меню'}
          className="admin-mobile-menu"
          size="icon"
          type="button"
          variant="outline"
          onClick={() => setIsNavigationOpen((value) => !value)}
        >
          <HugeiconsIcon icon={isNavigationOpen ? Cancel01Icon : Menu01Icon} size={20} strokeWidth={1.8} />
        </Button>
      </header>

      {isNavigationOpen ? (
        <button
          aria-label="Закрыть меню"
          className="admin-sidebar-backdrop"
          data-open
          type="button"
          onClick={closeNavigation}
        />
      ) : null}

      <aside className="admin-sidebar" data-open={isNavigationOpen || undefined}>
        <Link to="/" className="admin-brand admin-sidebar-brand" aria-label="Админка Чашка кофе — обзор" onClick={closeNavigation}>
          <span className="admin-brand-mark">ЧК</span>
          <span>
            <strong>Чашка кофе</strong>
            <small>Управление сайтом</small>
          </span>
        </Link>

        <AdminCommandMenu />

        <nav className="admin-navigation" aria-label="Разделы админки">
          <p className="admin-nav-label">Работа</p>
          {workspaceNavigation.filter((item) => !('permission' in item) || hasPermission(auth.user, item.permission)).map((item) => (
            <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === '/' }} className="admin-nav-link" onClick={closeNavigation}>
              <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          ))}

          {hasPermission(auth.user, 'LEADS_MANAGE') || hasPermission(auth.user, 'JOB_APPLICATIONS_MANAGE') ? (
            <>
              <Link to="/leads" className="admin-nav-link" onClick={closeNavigation}>
                <HugeiconsIcon icon={InboxIcon} size={18} strokeWidth={1.8} />
                <span>{hasPermission(auth.user, 'LEADS_MANAGE') ? 'Заявки' : 'Отклики'}</span>
              </Link>
            </>
          ) : null}
          {hasPermission(auth.user, 'ANALYTICS_READ') ? (
            <>
              <Link to="/statistics" className="admin-nav-link" onClick={closeNavigation}>
                <HugeiconsIcon icon={Analytics01Icon} size={18} strokeWidth={1.8} />
                <span>Статистика</span>
              </Link>
            </>
          ) : null}
          {pageNavigation.some((item) => hasPermission(auth.user, item.permission)) ? (
            <>
              <p className="admin-nav-label admin-nav-label-spaced">Страницы</p>
              {pageNavigation.filter((item) => hasPermission(auth.user, item.permission)).map((item) => (
                <Link key={item.to} to={item.to} className="admin-nav-link" onClick={closeNavigation}>
                  <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          ) : null}

          {catalogNavigation.some((item) => hasPermission(auth.user, item.permission)) ? <>
            <p className="admin-nav-label admin-nav-label-spaced">Каталог</p>
            {catalogNavigation.filter((item) => hasPermission(auth.user, item.permission)).map((item) => <Link key={item.to} to={item.to} className="admin-nav-link" onClick={closeNavigation}>
              <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>)}
          </> : null}

          {publicationNavigation.some((item) => hasPermission(auth.user, item.permission)) ? <>
            <p className="admin-nav-label admin-nav-label-spaced">Публикации</p>
            {publicationNavigation.filter((item) => hasPermission(auth.user, item.permission)).map((item) => <Link key={item.to} to={item.to} className="admin-nav-link" onClick={closeNavigation}>
              <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>)}
          </> : null}

          {hasPermission(auth.user, 'CONTENT_MANAGE') ? <>
            <p className="admin-nav-label admin-nav-label-spaced">Общие блоки</p>
            <Link to="/shared/header" className="admin-nav-link" onClick={closeNavigation}>
              <HugeiconsIcon icon={Menu01Icon} size={18} strokeWidth={1.8} />
              <span>Шапка и меню</span>
            </Link>
          </> : null}

          {hasPermission(auth.user, 'MEDIA_MANAGE') ? <>
            <p className="admin-nav-label admin-nav-label-spaced">Медиа</p>
            <Link to="/media" className="admin-nav-link" onClick={closeNavigation}>
              <HugeiconsIcon icon={Image01Icon} size={18} strokeWidth={1.8} />
              <span>Медиатека</span>
            </Link>
          </> : null}

          <p className="admin-nav-label admin-nav-label-spaced">Настройки</p>
          {hasPermission(auth.user, 'STAFF_MANAGE') || hasPermission(auth.user, 'AUDIT_READ') ? (
            <>
              {hasPermission(auth.user, 'STAFF_MANAGE') ? <Link to="/team" className="admin-nav-link" onClick={closeNavigation}>
                <HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={1.8} />
                <span>Команда</span>
              </Link> : null}
              {hasPermission(auth.user, 'AUDIT_READ') ? <Link to="/activity" className="admin-nav-link" onClick={closeNavigation}>
                <HugeiconsIcon icon={Clock01Icon} size={18} strokeWidth={1.8} />
                <span>История</span>
              </Link> : null}
              {hasPermission(auth.user, 'STAFF_MANAGE') ? <Link to="/telegram" className="admin-nav-link" onClick={closeNavigation}>
                <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={1.8} />
                <span>Telegram</span>
              </Link> : null}
            </>
          ) : null}
          <Link to="/app" className="admin-nav-link" onClick={closeNavigation}>
            <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={1.8} />
            <span>Профиль</span>
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/app" className="admin-user" onClick={closeNavigation}>
            <span className="admin-user-avatar">
              <HugeiconsIcon icon={UserCircleIcon} size={22} strokeWidth={1.7} />
            </span>
            <span>
              <strong>{auth.user.displayName ?? 'Сотрудник'}</strong>
              <small>{auth.user.roles.map((role) => roleLabel[role]).join(' · ')}</small>
            </span>
          </Link>
          <Button className="admin-logout" type="button" variant="ghost" size="sm" onClick={() => void auth.logout()}>
            <HugeiconsIcon icon={Logout01Icon} size={17} strokeWidth={1.8} />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="admin-main">
        <Outlet />
      </div>
    </main>
  )
}

export function HomePage() {
  const auth = useAuth()
  const dashboardStatistics = useQuery({
    queryKey: ['admin', 'analytics', 7],
    enabled: hasPermission(auth.user, 'ANALYTICS_READ'),
    queryFn: () => auth.api.request('/api/admin/analytics?days=7', analyticsSummaryResponseSchema),
  })
  const workspace = useQuery({
    queryKey: ['admin', 'workspace'],
    enabled: hasPermission(auth.user, 'AUDIT_READ'),
    queryFn: () => auth.api.request('/api/admin/workspace', adminWorkspaceResponseSchema),
  })

  if (auth.isBootstrapping) {
    return <LoadingState />
  }

  if (!auth.user) {
    return (
      <section className="admin-login-page">
        <div className="admin-login-intro">
          <span className="admin-brand-mark">ЧК</span>
          <p className="admin-eyebrow">Рабочее пространство</p>
          <h1>Управляйте<br />«Чашкой кофе».</h1>
          <p>Меню, рестораны, публикации и заявки — без лишних инструментов и путаницы в доступах.</p>
        </div>
        <AuthForm />
      </section>
    )
  }

  return (
    <section className="admin-page">
      <AdminPageHeader title="Обзор" />

      {hasPermission(auth.user, 'ANALYTICS_READ') ? (
        <>
        <section className="admin-dashboard-summary" aria-label="Краткая сводка за семь дней">
          <div className="admin-dashboard-summary-heading">
            <strong>Последние 7 дней</strong>
            <Button asChild size="sm" variant="outline"><Link to="/statistics">Открыть статистику</Link></Button>
          </div>
          <div className="admin-metric-strip">
            <DashboardMetric label="Просмотров" value={dashboardStatistics.data?.overview.views} />
            <DashboardMetric label="Посетителей" value={dashboardStatistics.data?.overview.visitors} />
            <DashboardMetric label="Просмотров сегодня" value={dashboardStatistics.data?.overview.todayViews} />
            <DashboardMetric label="Новых заявок" value={dashboardStatistics.data?.overview.newLeads} />
          </div>
          {dashboardStatistics.isError ? <p className="admin-state-message admin-state-error">Сводка временно недоступна. Остальные разделы можно использовать как обычно.</p> : null}
        </section>
        {hasPermission(auth.user, 'AUDIT_READ') ? <section className="admin-action-workspace" aria-label="Требует внимания">
          <div className="admin-section-heading"><strong>Требует внимания</strong></div>
          <div className="admin-action-queues">
            {workspace.data?.queues.map((queue) => <a className="admin-action-queue" data-tone={queue.tone} href={queue.href} key={queue.key}><span>{queue.label}</span><strong>{queue.count}</strong></a>)}
            {workspace.isPending ? <p className="admin-state-message">Собираем рабочую очередь…</p> : null}
            {workspace.isError ? <p className="admin-state-message admin-state-error">Рабочая очередь временно недоступна.</p> : null}
          </div>
        </section> : null}
        {workspace.data?.recentActivity.length ? <section className="admin-dashboard-activity"><div className="admin-section-heading"><strong>Последние изменения</strong><Button asChild size="sm" variant="ghost"><Link to="/activity">Вся история</Link></Button></div>{workspace.data.recentActivity.slice(0, 5).map((event) => <DashboardActivity key={event.id} event={event} />)}</section> : null}
        </>
      ) : null}

      <div className="admin-section-heading"><strong>Разделы</strong></div>
      <div className="admin-overview-grid">
        {hasPermission(auth.user, 'CATALOG_MANAGE') ? <><DashboardLink to="/restaurants" icon={RestaurantIcon} title="Рестораны" /><DashboardLink to="/menus" icon={MenuRestaurantIcon} title="Меню" /></> : null}
        {hasPermission(auth.user, 'CONTENT_MANAGE') ? <><DashboardLink to="/homepage" icon={Home01Icon} title="Главная страница" /><DashboardLink to="/content/promotions" icon={Megaphone01Icon} title="Материалы" /></> : null}
        {hasPermission(auth.user, 'LEADS_MANAGE') || hasPermission(auth.user, 'JOB_APPLICATIONS_MANAGE') ? <DashboardLink to="/leads" icon={InboxIcon} title={hasPermission(auth.user, 'LEADS_MANAGE') ? 'Заявки' : 'Отклики'} /> : null}
        {hasPermission(auth.user, 'MEDIA_MANAGE') ? <DashboardLink to="/media" icon={Image01Icon} title="Медиатека" /> : null}
      </div>
    </section>
  )
}

function DashboardMetric({ value, label }: { value: number | undefined; label: string }) {
  return <div><strong>{value === undefined ? '—' : value.toLocaleString('ru-RU')}</strong><span>{label}</span></div>
}

function DashboardActivity({ event }: { event: AuditEvent }) {
  const actions = { CREATE: 'создал(а)', UPDATE: 'изменил(а)', DELETE: 'удалил(а)', BULK_UPDATE: 'обновил(а) несколько записей' } as const
  return <div className="admin-dashboard-activity-row"><span><strong>{event.actorName}</strong> {actions[event.action]} · {event.resource}</span><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('ru-RU')}</time></div>
}

function DashboardLink({
  to,
  icon,
  title,
}: {
  to: '/restaurants' | '/menus' | '/homepage' | '/content/promotions' | '/leads' | '/media'
  icon: typeof RestaurantIcon
  title: string
}) {
  return (
    <Link to={to} className="admin-overview-link">
      <HugeiconsIcon icon={icon} size={24} strokeWidth={1.7} />
      <strong>{title}</strong>
      <HugeiconsIcon className="admin-overview-arrow" icon={ArrowRight01Icon} size={17} strokeWidth={1.8} />
    </Link>
  )
}

export function AppPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />

  return (
    <section className="admin-page admin-page-narrow">
      <AdminPageHeader
        eyebrow="Настройки"
        title="Профиль и доступ"
        description="Здесь собраны данные вашей учётной записи в админке."
      />
      <Card className="admin-profile-card">
        <CardHeader>
          <CardTitle>{auth.user.displayName ?? 'Сотрудник'}</CardTitle>
          <CardDescription>{auth.user.email}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ProfileField label="Роли" value={auth.user.roles.map((role) => roleLabel[role]).join(', ')} />
          <ProfileField label="Дата создания" value={new Date(auth.user.createdAt).toLocaleDateString('ru-RU')} />
          <ProfileField label="Идентификатор" value={auth.user.id} />
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void auth.logout()}>
              <HugeiconsIcon icon={Logout01Icon} size={17} strokeWidth={1.8} />
              Выйти из админки
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export function ActivityAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'AUDIT_READ')) return <AccessDenied title="История" description="История изменений доступна суперадмину." />
  return <ActivityPage />
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 sm:last-of-type:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="break-all text-sm font-medium">{value}</span>
    </div>
  )
}

export function RestaurantsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CATALOG_MANAGE')) return <AccessDenied title="Рестораны" description="Раздел доступен ответственному за меню." />
  return <RestaurantsPage />
}

export function RestaurantCreateAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CATALOG_MANAGE')) return <AccessDenied title="Рестораны" description="Раздел доступен ответственному за меню." />
  return <RestaurantsPage mode="create" />
}

export function RestaurantEditAdminRoute() {
  const auth = useAuth()
  const { restaurantId } = useParams({ strict: false }) as { restaurantId: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CATALOG_MANAGE')) return <AccessDenied title="Рестораны" description="Раздел доступен ответственному за меню." />
  return <RestaurantsPage mode="edit" restaurantId={restaurantId} />
}

export function TeamAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'STAFF_MANAGE')) return <AccessDenied title="Команда" description="Управление сотрудниками доступно суперадмину." />
  return <TeamPage />
}

export function TeamCreateAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'STAFF_MANAGE')) return <AccessDenied title="Команда" description="Управление сотрудниками доступно суперадмину." />
  return <TeamPage mode="create" />
}

export function TeamEditAdminRoute() {
  const auth = useAuth()
  const { userId } = useParams({ strict: false }) as { userId: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'STAFF_MANAGE')) return <AccessDenied title="Команда" description="Управление сотрудниками доступно суперадмину." />
  return <TeamPage mode="edit" userId={userId} />
}

export function MenuAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CATALOG_MANAGE')) return <AccessDenied title="Меню" description="Раздел доступен ответственному за меню." />
  return <MenuPage />
}

export function MenuCreateAdminRoute() { return <AuthenticatedMenu mode="create-menu" /> }
export function MenuDetailAdminRoute() { return <AuthenticatedMenu mode="detail" /> }
export function MenuCategoryCreateAdminRoute() { return <AuthenticatedMenu mode="create-category" /> }
export function MenuItemCreateAdminRoute() { return <AuthenticatedMenu mode="create-item" /> }
export function MenuItemEditAdminRoute() { return <AuthenticatedMenu mode="edit-item" /> }

function AuthenticatedMenu({ mode }: { mode: 'create-menu' | 'detail' | 'create-category' | 'create-item' | 'edit-item' }) {
  const auth = useAuth()
  const params = useParams({ strict: false }) as { menuId?: string; categoryId?: string; itemId?: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CATALOG_MANAGE')) return <AccessDenied title="Меню" description="Раздел доступен ответственному за меню." />
  return <MenuPage mode={mode} {...params} />
}

export function ContentPromotionsAdminRoute() { return <AdminContent type="PROMOTION" mode="list" /> }
export function ContentPromotionCreateAdminRoute() { return <AdminContent type="PROMOTION" mode="create" /> }
export function ContentPromotionEditAdminRoute() { return <AdminContent type="PROMOTION" mode="edit" /> }
export function ContentEventsAdminRoute() { return <AdminContent type="EVENT" mode="list" /> }
export function ContentEventCreateAdminRoute() { return <AdminContent type="EVENT" mode="create" /> }
export function ContentEventEditAdminRoute() { return <AdminContent type="EVENT" mode="edit" /> }
export function ContentJournalAdminRoute() { return <AdminContent type="ARTICLE" mode="list" /> }
export function ContentArticleCreateAdminRoute() { return <AdminContent type="ARTICLE" mode="create" /> }
export function ContentArticleEditAdminRoute() { return <AdminContent type="ARTICLE" mode="edit" /> }

function AdminContent({ type, mode }: { type: 'PROMOTION' | 'EVENT' | 'ARTICLE'; mode: 'list' | 'create' | 'edit' }) {
  const auth = useAuth()
  const { entryId } = useParams({ strict: false }) as { entryId?: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CONTENT_MANAGE')) return <AccessDenied title="Материалы" description="Публикации доступны контент-мейкеру." />
  return <ContentPage type={type} mode={mode} entryId={entryId} />
}

export function LeadsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'LEADS_MANAGE') && !hasPermission(auth.user, 'JOB_APPLICATIONS_MANAGE')) return <AccessDenied title="Заявки" description="Раздел доступен оператору заявок или рекрутеру." />
  return <LeadsPage />
}

export function OrdersAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'ORDERS_MANAGE')) return <AccessDenied title="Заказы" description="Раздел доступен оператору заказов." />
  return <OrdersPage />
}

export function TelegramNotificationsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'STAFF_MANAGE')) return <AccessDenied title="Telegram" description="Настройка уведомлений доступна суперадмину." />
  return <TelegramNotificationsPage />
}

export function SharedHeaderAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CONTENT_MANAGE')) return <AccessDenied title="Шапка и меню" description="Настройка общих блоков доступна редакторам сайта." />
  return <SharedHeaderPage />
}

export function CustomersAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CUSTOMERS_READ')) return <AccessDenied title="Клиенты" description="CRM доступна суперадмину." />
  return <CustomersPage />
}

export function CustomerDetailAdminRoute() {
  const auth = useAuth()
  const { customerId } = useParams({ strict: false }) as { customerId: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CUSTOMERS_READ')) return <AccessDenied title="Клиенты" description="CRM доступна суперадмину." />
  return <CustomerDetailPage customerId={customerId} />
}

export function MediaAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'MEDIA_MANAGE')) return <AccessDenied title="Медиатека" description="Медиатека доступна контент-мейкеру и ответственному за меню." />
  return <MediaPage />
}

export function JobsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'JOBS_MANAGE')) return <AccessDenied title="Вакансии" description="Вакансии доступны рекрутеру." />
  return <JobsPage />
}

export function JobCreateAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'JOBS_MANAGE')) return <AccessDenied title="Вакансии" description="Вакансии доступны рекрутеру." />
  return <JobsPage mode="create" />
}

export function JobEditAdminRoute() {
  const auth = useAuth()
  const { openingId } = useParams({ strict: false }) as { openingId: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'JOBS_MANAGE')) return <AccessDenied title="Вакансии" description="Вакансии доступны рекрутеру." />
  return <JobsPage mode="edit" openingId={openingId} />
}

export function HomepageAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CONTENT_MANAGE')) return <AccessDenied title="Главная страница" description="Настройка главной доступна контент-мейкеру." />
  return <HomepagePage />
}

export function ProductsCoffeeAdminRoute() { return <AdminProducts type="COFFEE" mode="list" /> }
export function ProductCoffeeCreateAdminRoute() { return <AdminProducts type="COFFEE" mode="create" /> }
export function ProductCoffeeEditAdminRoute() { return <AdminProducts type="COFFEE" mode="edit" /> }
export function ProductsCakesAdminRoute() { return <AdminProducts type="CAKE" mode="list" /> }
export function ProductCakeCreateAdminRoute() { return <AdminProducts type="CAKE" mode="create" /> }
export function ProductCakeEditAdminRoute() { return <AdminProducts type="CAKE" mode="edit" /> }

function AdminProducts({ type, mode }: { type: 'COFFEE' | 'CAKE'; mode: 'list' | 'create' | 'edit' }) {
  const auth = useAuth()
  const { productId } = useParams({ strict: false }) as { productId?: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CATALOG_MANAGE')) return <AccessDenied title="Кофе и торты" description="Каталог доступен ответственному за меню." />
  return <ProductsPage type={type} mode={mode} productId={productId} />
}

export function StatisticsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'ANALYTICS_READ')) return <AccessDenied title="Статистика" description="Статистика доступна суперадмину." />
  return <StatisticsPage />
}

export function ManagedPagesAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CONTENT_MANAGE')) return <AccessDenied title="Страницы" description="Редактор страниц доступен контент-мейкеру." />
  return <ManagedPagesPage />
}

export function ManagedPageEditAdminRoute() {
  const auth = useAuth()
  const { pageKey } = useParams({ strict: false }) as { pageKey: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (!hasPermission(auth.user, 'CONTENT_MANAGE')) return <AccessDenied title="Страницы" description="Редактор страниц доступен контент-мейкеру." />
  return <ManagedPagesPage mode="edit" pageKey={pageKey} />
}

function AccessDenied({ title, description }: { title: string; description: string }) {
  return (
    <section className="admin-page admin-page-narrow">
      <AdminPageHeader eyebrow="Нет доступа" title={title} description={description} />
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Обратитесь к администратору, если вам нужно работать с этим разделом.
        </CardContent>
      </Card>
    </section>
  )
}

function LoadingState() {
  return (
    <section className="admin-loading">
      <Spinner />
      <span>Проверяем доступ…</span>
    </section>
  )
}
