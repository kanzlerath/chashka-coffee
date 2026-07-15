import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { AppPage, HomePage, RestaurantsAdminRoute, RootLayout } from './pages'

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

const routeTree = rootRoute.addChildren([indexRoute, appRoute, restaurantsRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
