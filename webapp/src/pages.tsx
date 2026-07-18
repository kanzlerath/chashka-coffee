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
import { Link, Outlet } from '@tanstack/react-router'

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
import { TeamPage } from '@/features/staff-admin'

const coreNavigation = [
  { to: '/', label: 'Обзор', icon: DashboardSquare01Icon },
  { to: '/restaurants', label: 'Рестораны', icon: RestaurantIcon },
  { to: '/menus', label: 'Меню', icon: MenuRestaurantIcon },
] as const

const adminNavigation = [
  { to: '/homepage', label: 'Главная', icon: DashboardSquare01Icon },
  { to: '/content', label: 'Материалы', icon: File01Icon },
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
              <p className="admin-nav-label admin-nav-label-spaced">Публикация</p>
              {adminNavigation.map((item) => (
                <Link key={item.to} to={item.to} className="admin-nav-link">
                  <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          ) : null}

          <p className="admin-nav-label admin-nav-label-spaced">Настройки</p>
          <Link to="/team" className="admin-nav-link">
            <HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={1.8} />
            <span>Команда</span>
          </Link>
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

      <div className="admin-overview-grid">
        <DashboardLink to="/restaurants" icon={RestaurantIcon} title="Рестораны" description="Адреса, часы работы и меню каждой точки." />
        <DashboardLink to="/menus" icon={MenuRestaurantIcon} title="Меню" description="Категории, блюда, цены и доступность." />
        {auth.user.role === 'ADMIN' ? (
          <>
            <DashboardLink to="/homepage" icon={DashboardSquare01Icon} title="Главная страница" description="Галерея, бестселлеры и смысловые блоки." />
            <DashboardLink to="/content" icon={File01Icon} title="Материалы" description="Акции, события и статьи журнала." />
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
          <Badge variant="outline">Роль: {auth.user.role === 'ADMIN' ? 'администратор' : 'редактор'}</Badge>
        </CardContent>
      </Card>
    </section>
  )
}

function DashboardLink({
  to,
  icon,
  title,
  description,
}: {
  to: '/restaurants' | '/menus' | '/homepage' | '/content' | '/leads' | '/media'
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

export function TeamAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  return <TeamPage />
}

export function MenuAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  return <MenuPage />
}

export function ContentAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  return <ContentPage />
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

export function HomepageAdminRoute() {
  const auth = useAuth()
  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <HomePage />
  if (auth.user.role !== 'ADMIN') return <AccessDenied title="Главная страница" description="Настройка главной доступна администраторам." />
  return <HomepagePage />
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
