import {
  Briefcase01Icon,
  DashboardSquare01Icon,
  File01Icon,
  Image01Icon,
  InboxIcon,
  Logout01Icon,
  MenuRestaurantIcon,
  RestaurantIcon,
  Settings01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { analyticsSummaryResponseSchema } from '@chashka-coffee/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useParams } from '@tanstack/react-router'

import { AdminPageHeader } from '@/components/admin'
import { Badge } from '@/components/ui/badge'
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

const coreNavigation = [
  { to: '/', label: 'Обзор', icon: DashboardSquare01Icon },
  { to: '/restaurants', label: 'Рестораны', icon: RestaurantIcon },
  { to: '/menus', label: 'Меню', icon: MenuRestaurantIcon },
] as const

const adminNavigation = [
  { to: '/homepage', label: 'Главная', icon: DashboardSquare01Icon },
  { to: '/pages', label: 'Страницы', icon: File01Icon },
  { to: '/media', label: 'Медиатека', icon: Image01Icon },
  { to: '/leads', label: 'Заявки', icon: InboxIcon },
  { to: '/jobs', label: 'Вакансии', icon: Briefcase01Icon },
] as const

export function RootLayout() {
  const auth = useAuth()

  if (!auth.user) {
    return (
      <main className="admin-auth-shell">
        <Outlet />
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand" aria-label="Админка Чашка кофе — обзор">
          <span className="admin-brand-mark">ЧК</span>
          <span>
            <strong>Чашка кофе</strong>
            <small>Админ-панель</small>
          </span>
        </Link>

        <nav className="admin-navigation" aria-label="Разделы админки">
          <p className="admin-nav-label">Управление сайтом</p>
          {coreNavigation.map((item) => (
            <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === '/' }} className="admin-nav-link">
              <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          ))}

          {auth.user.role === 'ADMIN' ? (
            <>
              <Link to="/statistics" className="admin-nav-link">
                <HugeiconsIcon icon={DashboardSquare01Icon} size={18} strokeWidth={1.8} />
                <span>Статистика</span>
              </Link>
              <p className="admin-nav-label admin-nav-label-spaced">Витрина</p>
              <Link to="/products/coffee" className="admin-nav-link admin-nav-child"><span>Кофе</span></Link>
              <Link to="/products/cakes" className="admin-nav-link admin-nav-child"><span>Торты</span></Link>

              <p className="admin-nav-label admin-nav-label-spaced">Публикация</p>
              {adminNavigation.map((item) => (
                <Link key={item.to} to={item.to} className="admin-nav-link">
                  <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              ))}
              <div className="admin-nav-subgroup" aria-label="Материалы">
                <span>Материалы</span>
                <Link to="/content/promotions" className="admin-nav-link admin-nav-child"><span>Акции</span></Link>
                <Link to="/content/events" className="admin-nav-link admin-nav-child"><span>События</span></Link>
                <Link to="/content/journal" className="admin-nav-link admin-nav-child"><span>Журнал</span></Link>
              </div>
            </>
          ) : null}

          <p className="admin-nav-label admin-nav-label-spaced">Настройки</p>
          {auth.user.role === 'ADMIN' ? (
            <Link to="/team" className="admin-nav-link">
              <HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={1.8} />
              <span>Команда</span>
            </Link>
          ) : null}
          <Link to="/app" className="admin-nav-link">
            <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={1.8} />
            <span>Профиль</span>
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/app" className="admin-user">
            <span className="admin-user-avatar">
              <HugeiconsIcon icon={UserCircleIcon} size={22} strokeWidth={1.7} />
            </span>
            <span>
              <strong>{auth.user.displayName ?? 'Сотрудник'}</strong>
              <small>{auth.user.role === 'ADMIN' ? 'Администратор' : 'Редактор'}</small>
            </span>
          </Link>
          <Button className="admin-logout" type="button" variant="ghost" size="sm" onClick={() => void auth.logout()}>
            <HugeiconsIcon icon={Logout01Icon} size={17} strokeWidth={1.8} />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <p>Управление сайтом</p>
          <div>
            <span className="admin-topbar-status" />
            Сессия активна
          </div>
        </header>
        <Outlet />
      </div>
    </main>
  )
}

export function HomePage() {
  const auth = useAuth()
  const dashboardStatistics = useQuery({
    queryKey: ['admin', 'analytics', 7],
    enabled: auth.user?.role === 'ADMIN',
    queryFn: () => auth.api.request('/api/admin/analytics?days=7', analyticsSummaryResponseSchema),
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
      <AdminPageHeader
        eyebrow="Рабочее пространство"
        title={`Добрый день, ${auth.user.displayName?.split(' ')[0] ?? 'коллега'}.`}
        description="Выберите, с чем хотите работать. Все изменения сохраняются в базу и попадают на сайт после публикации."
      />

      {auth.user.role === 'ADMIN' ? (
        <section className="admin-dashboard-summary" aria-label="Краткая сводка за семь дней">
          <div className="admin-dashboard-summary-heading">
            <div><strong>Что происходит на сайте</strong><p>Краткая сводка за последние 7 дней.</p></div>
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
      ) : null}

      <div className="admin-overview-grid">
        <DashboardLink to="/restaurants" icon={RestaurantIcon} title="Рестораны" description="Адреса, часы работы и меню каждой точки." />
        <DashboardLink to="/menus" icon={MenuRestaurantIcon} title="Меню" description="Категории, блюда, цены и доступность." />
        {auth.user.role === 'ADMIN' ? (
          <>
            <DashboardLink to="/homepage" icon={DashboardSquare01Icon} title="Главная страница" description="Галерея, бестселлеры и смысловые блоки." />
            <DashboardLink to="/content/promotions" icon={File01Icon} title="Материалы" description="Акции, события и статьи журнала." />
            <DashboardLink to="/leads" icon={InboxIcon} title="Заявки" description="Обращения с сайта и их статусы." />
            <DashboardLink to="/media" icon={Image01Icon} title="Медиатека" description="Фотографии для блюд, страниц и публикаций." />
          </>
        ) : null}
      </div>

      <Card className="admin-note-card" size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>Нужна помощь с наполнением?</strong>
            <p>Поля с обязательными данными отмечены прямо в формах. Сначала создайте сущность, затем опубликуйте её на сайте.</p>
          </div>
          <div className="admin-dashboard-help-actions">
            {auth.user.role === 'ADMIN' ? <Button asChild size="sm" variant="outline"><Link to="/team">Команда и доступы</Link></Button> : null}
            <Badge variant="outline">Роль: {auth.user.role === 'ADMIN' ? 'администратор' : 'редактор'}</Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function DashboardMetric({ value, label }: { value: number | undefined; label: string }) {
  return <div><strong>{value === undefined ? '—' : value.toLocaleString('ru-RU')}</strong><span>{label}</span></div>
}

function DashboardLink({
  to,
  icon,
  title,
  description,
}: {
  to: '/restaurants' | '/menus' | '/homepage' | '/content/promotions' | '/leads' | '/media'
  icon: typeof RestaurantIcon
  title: string
  description: string
}) {
  return (
    <Link to={to} className="admin-overview-link">
      <HugeiconsIcon icon={icon} size={24} strokeWidth={1.7} />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
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
          <ProfileField label="Роль" value={auth.user.role === 'ADMIN' ? 'Администратор' : 'Редактор'} />
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
  return <RestaurantsPage />
}

export function RestaurantCreateAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  return <RestaurantsPage mode="create" />
}

export function RestaurantEditAdminRoute() {
  const auth = useAuth()
  const { restaurantId } = useParams({ strict: false }) as { restaurantId: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  return <RestaurantsPage mode="edit" restaurantId={restaurantId} />
}

export function TeamAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Команда" description="Управление сотрудниками доступно администраторам." />
  return <TeamPage />
}

export function TeamCreateAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Команда" description="Управление сотрудниками доступно администраторам." />
  return <TeamPage mode="create" />
}

export function TeamEditAdminRoute() {
  const auth = useAuth()
  const { userId } = useParams({ strict: false }) as { userId: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Команда" description="Управление сотрудниками доступно администраторам." />
  return <TeamPage mode="edit" userId={userId} />
}

export function MenuAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
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
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Материалы" description="Публикации доступны администраторам." />
  return <ContentPage type={type} mode={mode} entryId={entryId} />
}

export function LeadsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Заявки" description="Просмотр заявок доступен администраторам." />
  return <LeadsPage />
}

export function MediaAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Медиатека" description="Медиатека доступна администраторам." />
  return <MediaPage />
}

export function JobsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Вакансии" description="Вакансии доступны администраторам." />
  return <JobsPage />
}

export function JobCreateAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Вакансии" description="Вакансии доступны администраторам." />
  return <JobsPage mode="create" />
}

export function JobEditAdminRoute() {
  const auth = useAuth()
  const { openingId } = useParams({ strict: false }) as { openingId: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Вакансии" description="Вакансии доступны администраторам." />
  return <JobsPage mode="edit" openingId={openingId} />
}

export function HomepageAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Главная страница" description="Настройка главной доступна администраторам." />
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
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Кофе и торты" description="Каталог товаров доступен администраторам." />
  return <ProductsPage type={type} mode={mode} productId={productId} />
}

export function StatisticsAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Статистика" description="Статистика доступна администраторам." />
  return <StatisticsPage />
}

export function ManagedPagesAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Страницы" description="Редактор страниц доступен администраторам." />
  return <ManagedPagesPage />
}

export function ManagedPageEditAdminRoute() {
  const auth = useAuth()
  const { pageKey } = useParams({ strict: false }) as { pageKey: string }
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Страницы" description="Редактор страниц доступен администраторам." />
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
