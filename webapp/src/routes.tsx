import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  ActivityAdminRoute,
  AppPage,
  ContentArticleCreateAdminRoute,
  ContentArticleEditAdminRoute,
  ContentEventCreateAdminRoute,
  ContentEventEditAdminRoute,
  ContentEventsAdminRoute,
  ContentJournalAdminRoute,
  ContentPromotionCreateAdminRoute,
  ContentPromotionEditAdminRoute,
  ContentPromotionsAdminRoute,
  HomePage,
  HomepageAdminRoute,
  JobCreateAdminRoute,
  JobEditAdminRoute,
  JobsAdminRoute,
  LeadsAdminRoute,
  OrdersAdminRoute,
  ManagedPagesAdminRoute,
  ManagedPageEditAdminRoute,
  MediaAdminRoute,
  MenuAdminRoute,
  MenuCategoryCreateAdminRoute,
  MenuCreateAdminRoute,
  MenuDetailAdminRoute,
  MenuItemCreateAdminRoute,
  MenuItemEditAdminRoute,
  ProductCakeCreateAdminRoute,
  ProductCakeEditAdminRoute,
  ProductCoffeeCreateAdminRoute,
  ProductCoffeeEditAdminRoute,
  ProductsCakesAdminRoute,
  ProductsCoffeeAdminRoute,
  RestaurantsAdminRoute,
  RestaurantCreateAdminRoute,
  RestaurantEditAdminRoute,
  RootLayout,
  StatisticsAdminRoute,
  TeamAdminRoute,
  TeamCreateAdminRoute,
  TeamEditAdminRoute,
} from './pages'

const rootRoute = createRootRoute({ component: RootLayout })
const route = <TPath extends string>(path: TPath, component: () => ReactNode) => createRoute({ getParentRoute: () => rootRoute, path, component })

const indexRoute = route('/', HomePage)
const appRoute = route('/app', AppPage)
const activityRoute = route('/activity', ActivityAdminRoute)
const statisticsRoute = route('/statistics', StatisticsAdminRoute)
const ordersRoute = route('/orders', OrdersAdminRoute)
const restaurantsRoute = route('/restaurants', RestaurantsAdminRoute)
const restaurantCreateRoute = route('/restaurants/new', RestaurantCreateAdminRoute)
const restaurantEditRoute = route('/restaurants/$restaurantId', RestaurantEditAdminRoute)

const menusRoute = route('/menus', MenuAdminRoute)
const menuCreateRoute = route('/menus/new', MenuCreateAdminRoute)
const menuDetailRoute = route('/menus/$menuId', MenuDetailAdminRoute)
const menuCategoryCreateRoute = route('/menus/$menuId/categories/new', MenuCategoryCreateAdminRoute)
const menuItemCreateRoute = route('/menus/$menuId/categories/$categoryId/items/new', MenuItemCreateAdminRoute)
const menuItemEditRoute = route('/menus/$menuId/items/$itemId', MenuItemEditAdminRoute)

const teamRoute = route('/team', TeamAdminRoute)
const teamCreateRoute = route('/team/new', TeamCreateAdminRoute)
const teamEditRoute = route('/team/$userId', TeamEditAdminRoute)

const productsLegacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/products', beforeLoad: () => { throw redirect({ to: '/products/coffee' }) } })
const coffeeRoute = route('/products/coffee', ProductsCoffeeAdminRoute)
const coffeeCreateRoute = route('/products/coffee/new', ProductCoffeeCreateAdminRoute)
const coffeeEditRoute = route('/products/coffee/$productId', ProductCoffeeEditAdminRoute)
const cakesRoute = route('/products/cakes', ProductsCakesAdminRoute)
const cakeCreateRoute = route('/products/cakes/new', ProductCakeCreateAdminRoute)
const cakeEditRoute = route('/products/cakes/$productId', ProductCakeEditAdminRoute)

const contentLegacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/content', beforeLoad: () => { throw redirect({ to: '/content/promotions' }) } })
const promotionsRoute = route('/content/promotions', ContentPromotionsAdminRoute)
const promotionCreateRoute = route('/content/promotions/new', ContentPromotionCreateAdminRoute)
const promotionEditRoute = route('/content/promotions/$entryId', ContentPromotionEditAdminRoute)
const eventsRoute = route('/content/events', ContentEventsAdminRoute)
const eventCreateRoute = route('/content/events/new', ContentEventCreateAdminRoute)
const eventEditRoute = route('/content/events/$entryId', ContentEventEditAdminRoute)
const journalRoute = route('/content/journal', ContentJournalAdminRoute)
const articleCreateRoute = route('/content/journal/new', ContentArticleCreateAdminRoute)
const articleEditRoute = route('/content/journal/$entryId', ContentArticleEditAdminRoute)

const homepageRoute = route('/homepage', HomepageAdminRoute)
const leadsRoute = route('/leads', LeadsAdminRoute)
const mediaRoute = route('/media', MediaAdminRoute)
const jobsRoute = route('/jobs', JobsAdminRoute)
const jobCreateRoute = route('/jobs/new', JobCreateAdminRoute)
const jobEditRoute = route('/jobs/$openingId', JobEditAdminRoute)
const pagesRoute = route('/pages', ManagedPagesAdminRoute)
const pageEditRoute = route('/pages/$pageKey', ManagedPageEditAdminRoute)

const routeTree = rootRoute.addChildren([
  indexRoute, appRoute, activityRoute, statisticsRoute, ordersRoute, restaurantsRoute, restaurantCreateRoute, restaurantEditRoute,
  menusRoute, menuCreateRoute, menuDetailRoute, menuCategoryCreateRoute, menuItemCreateRoute, menuItemEditRoute,
  teamRoute, teamCreateRoute, teamEditRoute,
  productsLegacyRoute, coffeeRoute, coffeeCreateRoute, coffeeEditRoute, cakesRoute, cakeCreateRoute, cakeEditRoute,
  contentLegacyRoute, promotionsRoute, promotionCreateRoute, promotionEditRoute, eventsRoute, eventCreateRoute, eventEditRoute, journalRoute, articleCreateRoute, articleEditRoute,
  homepageRoute, leadsRoute, mediaRoute, jobsRoute, jobCreateRoute, jobEditRoute, pagesRoute, pageEditRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
