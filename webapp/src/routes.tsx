import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { AppPage, ContentAdminRoute, HomePage, HomepageAdminRoute, JobsAdminRoute, LeadsAdminRoute, ManagedPagesAdminRoute, MediaAdminRoute, MenuAdminRoute, ProductsAdminRoute, RestaurantsAdminRoute, RootLayout, TeamAdminRoute } from './pages'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppPage,
})

const restaurantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/restaurants',
  component: RestaurantsAdminRoute,
})
const teamRoute = createRoute({ getParentRoute: () => rootRoute, path: '/team', component: TeamAdminRoute })
const menusRoute = createRoute({ getParentRoute: () => rootRoute, path: '/menus', component: MenuAdminRoute })
const contentRoute = createRoute({ getParentRoute: () => rootRoute, path: '/content', component: ContentAdminRoute })
const homepageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/homepage', component: HomepageAdminRoute })
const leadsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/leads', component: LeadsAdminRoute })
const mediaRoute = createRoute({ getParentRoute: () => rootRoute, path: '/media', component: MediaAdminRoute })
const jobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/jobs', component: JobsAdminRoute })
const productsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/products', component: ProductsAdminRoute })
const pagesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pages', component: ManagedPagesAdminRoute })

const routeTree = rootRoute.addChildren([indexRoute, appRoute, restaurantsRoute, teamRoute, menusRoute, contentRoute, homepageRoute, leadsRoute, mediaRoute, jobsRoute, productsRoute, pagesRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
