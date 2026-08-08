import type { DbClient } from '../../db'

export function valueReferencesMediaUrl(value: unknown, publicUrl: string): boolean {
  if (typeof value === 'string') return value === publicUrl
  if (Array.isArray(value)) return value.some((item) => valueReferencesMediaUrl(item, publicUrl))
  if (!value || typeof value !== 'object') return false
  return Object.values(value).some((item) => valueReferencesMediaUrl(item, publicUrl))
}

export async function findMediaAssetReferences(db: DbClient, publicUrl: string) {
  const [contentEntries, managedPages, products, homepageSlides, restaurants, menuItems, orderItems, siteSettings] = await Promise.all([
    db.contentEntry.findMany({ select: { imageUrl: true, body: true, blocks: true } }),
    db.managedPage.findMany({ select: { heroImageUrl: true, coffeeTastes: true, appChoices: true, images: true, blocks: true } }),
    db.product.findMany({ select: { imageUrl: true, galleryUrls: true, details: true, blocks: true } }),
    db.homepageSlide.findMany({ select: { mediaUrl: true, posterUrl: true } }),
    db.restaurant.findMany({ select: { coverImageUrl: true, menuPdfUrl: true, visitAmenities: true, galleryUrls: true } }),
    db.menuItem.findMany({ select: { imageUrl: true } }),
    db.orderItem.findMany({ select: { imageUrl: true } }),
    db.siteSettings.findMany({ select: { headerPreviews: true } }),
  ])

  const references: string[] = []
  if (contentEntries.some((entry) => entry.imageUrl === publicUrl || valueReferencesMediaUrl(entry.body, publicUrl) || valueReferencesMediaUrl(entry.blocks, publicUrl))) references.push('материалах')
  if (managedPages.some((page) => page.heroImageUrl === publicUrl || valueReferencesMediaUrl(page.coffeeTastes, publicUrl) || valueReferencesMediaUrl(page.appChoices, publicUrl) || valueReferencesMediaUrl(page.images, publicUrl) || valueReferencesMediaUrl(page.blocks, publicUrl))) references.push('страницах сайта')
  if (products.some((product) => product.imageUrl === publicUrl || valueReferencesMediaUrl(product.galleryUrls, publicUrl) || valueReferencesMediaUrl(product.details, publicUrl) || valueReferencesMediaUrl(product.blocks, publicUrl))) references.push('товарах')
  if (homepageSlides.some((slide) => slide.mediaUrl === publicUrl || slide.posterUrl === publicUrl)) references.push('слайдах главной страницы')
  if (restaurants.some((restaurant) => restaurant.coverImageUrl === publicUrl || restaurant.menuPdfUrl === publicUrl || valueReferencesMediaUrl(restaurant.visitAmenities, publicUrl) || valueReferencesMediaUrl(restaurant.galleryUrls, publicUrl))) references.push('ресторанах')
  if (menuItems.some((item) => item.imageUrl === publicUrl)) references.push('блюдах меню')
  if (orderItems.some((item) => item.imageUrl === publicUrl)) references.push('истории заказов')
  if (siteSettings.some((settings) => valueReferencesMediaUrl(settings.headerPreviews, publicUrl))) references.push('настройках шапки')
  return references
}
