import { Link, Outlet } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'
import { AuthForm, useAuth } from '@/features/auth'
import { MenuPage, RestaurantsPage } from '@/features/catalog-admin'
import { ContentPage } from '@/features/content-admin'
import { LeadsPage } from '@/features/leads-admin'
import { MediaPage } from '@/features/media-admin'
import { JobsPage } from '@/features/jobs-admin'
import { HomepagePage } from '@/features/homepage-admin'
import { TeamPage } from '@/features/staff-admin'
import { cn } from '@/lib/utils'

const navLinkClass = cn(
  buttonVariants({ variant: 'ghost', size: 'sm' }),
  'text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground data-[status=active]:hover:bg-secondary/80 data-[status=active]:hover:text-secondary-foreground'
)

export function RootLayout() {
  const auth = useAuth()

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
          <Typography asChild variant="h6">
            <Link to="/">chashka_coffee</Link>
          </Typography>
          <nav className="ml-auto flex items-center gap-2" aria-label="Primary">
            <Typography asChild variant="control" tone="muted">
              <Link to="/restaurants" className={navLinkClass}>
                Кофейни
              </Link>
            </Typography>
            <Typography asChild variant="control" tone="muted"><Link to="/menus" className={navLinkClass}>Меню</Link></Typography>
            <Typography asChild variant="control" tone="muted"><Link to="/content" className={navLinkClass}>Контент</Link></Typography>
            {auth.user?.role === 'ADMIN' && <Typography asChild variant="control" tone="muted"><Link to="/homepage" className={navLinkClass}>Главная</Link></Typography>}
            {auth.user?.role === 'ADMIN' && <Typography asChild variant="control" tone="muted"><Link to="/leads" className={navLinkClass}>Заявки</Link></Typography>}
            {auth.user?.role === 'ADMIN' && <Typography asChild variant="control" tone="muted"><Link to="/media" className={navLinkClass}>Медиа</Link></Typography>}
            {auth.user?.role === 'ADMIN' && <Typography asChild variant="control" tone="muted"><Link to="/jobs" className={navLinkClass}>Вакансии</Link></Typography>}
            <Typography asChild variant="control" tone="muted">
              <Link to="/team" className={navLinkClass}>
                Команда
              </Link>
            </Typography>
            <Typography asChild variant="control" tone="muted">
              <Link to="/app" className={navLinkClass}>
                App
              </Link>
            </Typography>
          </nav>
          {auth.isAuthenticated && (
            <Button type="button" variant="outline" size="sm" onClick={() => void auth.logout()}>
              Logout
            </Button>
          )}
        </div>
      </header>
      <Outlet />
    </main>
  )
}

export function HomePage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <LoadingState />
  }

  if (auth.user) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-16">
        <Badge variant="outline" className="w-fit">
          Админка «Чашки кофе»
        </Badge>
        <div className="grid max-w-3xl gap-4">
          <Typography variant="h1">Сайт наполняется<br/>из админки.</Typography>
          <Typography className="max-w-2xl" tone="muted">
            Вы вошли как{' '}
            <Typography as="strong" variant="emphasis" tone="default">
              {auth.user.email}
            </Typography>
            . Управляйте кофейнями, меню, контентом и заявками в одном месте.
            This is the baseline auth pattern for future web features.
          </Typography>
        </div>
        <Button asChild size="lg" className="w-fit">
          <Link to="/restaurants">Открыть кофейни</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
      <div className="grid gap-5">
        <Badge variant="outline" className="w-fit">
          Golden path template
        </Badge>
        <Typography className="max-w-3xl" variant="h1">
          Auth, validation, API state, and forms are wired from day one.
        </Typography>
        <Typography className="max-w-2xl" tone="muted">
          The web app uses shared Zod contracts, TanStack Query for server state, TanStack Form for
          input state, and an API client that refreshes sessions through the backend.
        </Typography>
      </div>
      <AuthForm />
    </section>
  )
}

export function AppPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return <LoadingState />
  }

  if (!auth.user) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-16">
        <Badge variant="outline" className="w-fit">
          Protected example
        </Badge>
        <div className="grid max-w-3xl gap-4">
          <Typography variant="h1">Login required</Typography>
          <Typography className="max-w-2xl" tone="muted">
            This route intentionally stays small and shows where protected product UI begins.
          </Typography>
        </div>
        <Button asChild size="lg" className="w-fit">
          <Link to="/">Go to auth</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-12">
      <div className="grid gap-3">
        <Badge variant="outline" className="w-fit">
          Current user
        </Badge>
        <Typography variant="h1">
          {auth.user.displayName ?? auth.user.email}
        </Typography>
        <Typography tone="muted">{auth.user.email}</Typography>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>User ID</CardTitle>
            <CardDescription wrap="break">{auth.user.id}</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Created</CardTitle>
            <CardDescription>{new Date(auth.user.createdAt).toLocaleString()}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
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
export function MenuAdminRoute() { const auth = useAuth(); if (auth.isBootstrapping) return <LoadingState />; if (!auth.user) return <HomePage />; return <MenuPage /> }
export function ContentAdminRoute() { const auth = useAuth(); if (auth.isBootstrapping) return <LoadingState />; if (!auth.user) return <HomePage />; return <ContentPage /> }
export function LeadsAdminRoute() { const auth = useAuth(); if (auth.isBootstrapping) return <LoadingState />; if (!auth.user) return <HomePage />; if (auth.user.role !== 'ADMIN') return <section className="mx-auto w-full max-w-6xl px-5 py-12"><Card><CardHeader><CardTitle>Недостаточно прав</CardTitle><CardDescription>Просмотр заявок доступен администраторам.</CardDescription></CardHeader></Card></section>; return <LeadsPage /> }
export function MediaAdminRoute() { const auth = useAuth(); if (auth.isBootstrapping) return <LoadingState />; if (!auth.user) return <HomePage />; if (auth.user.role !== 'ADMIN') return <section className="mx-auto w-full max-w-6xl px-5 py-12"><Card><CardHeader><CardTitle>Недостаточно прав</CardTitle><CardDescription>Медиатека доступна администраторам.</CardDescription></CardHeader></Card></section>; return <MediaPage /> }
export function JobsAdminRoute() { const auth = useAuth(); if (auth.isBootstrapping) return <LoadingState />; if (!auth.user) return <HomePage />; if (auth.user.role !== 'ADMIN') return <section className="mx-auto w-full max-w-6xl px-5 py-12"><Card><CardHeader><CardTitle>Недостаточно прав</CardTitle><CardDescription>Вакансии доступны администраторам.</CardDescription></CardHeader></Card></section>; return <JobsPage /> }
export function HomepageAdminRoute() { const auth = useAuth(); if (auth.isBootstrapping) return <LoadingState />; if (!auth.user) return <HomePage />; if (auth.user.role !== 'ADMIN') return <section className="mx-auto w-full max-w-6xl px-5 py-12"><Card><CardHeader><CardTitle>Недостаточно прав</CardTitle><CardDescription>Настройка главной доступна администраторам.</CardDescription></CardHeader></Card></section>; return <HomepagePage /> }

function LoadingState() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16">
      <Card className="w-fit">
        <CardContent className="flex items-center gap-3">
          <Spinner />
          <Typography variant="bodySm" tone="muted">
            Checking session...
          </Typography>
        </CardContent>
      </Card>
    </section>
  )
}
