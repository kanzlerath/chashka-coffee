import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { AppPage, ContentAdminRoute, HomePage, MenuAdminRoute, RestaurantsAdminRoute, RootLayout, TeamAdminRoute } from './pages'

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

const routeTree = rootRoute.addChildren([indexRoute, appRoute, restaurantsRoute, teamRoute, menusRoute, contentRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
