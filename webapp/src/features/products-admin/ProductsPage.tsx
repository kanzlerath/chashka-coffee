import { productDeleteResponseSchema, productListResponseSchema, productResponseSchema, upsertProductRequestSchema, type Product, type ProductType, type UpsertProductRequest } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { nullableDraftText } from '@/lib/form-drafts'
import { toPublicSlug } from '@/lib/slugify'

type ProductsPageProps = { type: ProductType; mode?: 'list' | 'create' | 'edit'; productId?: string }
const nullable = nullableDraftText
const empty = (type: ProductType): UpsertProductRequest => ({ type, status: 'DRAFT', slug: '', name: '', category: type === 'CAKE' ? 'Торты' : null, subtitle: null, description: null, ingredients: null, origin: null, roastLevel: null, tastingNotes: [], imageUrl: null, galleryUrls: [], details: [], isFeatured: false, position: 10, variants: [{ label: type === 'COFFEE' ? '250 г' : '1 кг', weightGrams: type === 'COFFEE' ? 250 : 1000, priceKopecks: 0, position: 10, isAvailable: true }] })

export function ProductsPage({ type, mode = 'list', productId }: ProductsPageProps) {
  if (mode === 'list') return <ProductList type={type} />
  return <ProductEditor mode={mode} productId={productId} type={type} />
}

function useProducts(type: ProductType) {
  const { api } = useAuth()
  return useQuery({ queryKey: ['admin', 'products', type], queryFn: () => api.request(`/api/admin/products?type=${type}`, productListResponseSchema) })
}

function ProductList({ type }: { type: ProductType }) {
  const products = useProducts(type)
  const noun = type === 'COFFEE' ? 'Кофе' : 'Торты'
  const base = type === 'COFFEE' ? '/products/coffee' : '/products/cakes'
  return <section className="admin-page">
    <AdminPageHeader eyebrow="Витрина" title={noun} description={type === 'COFFEE' ? 'Зерно и варианты фасовки, которые показываются в разделе «Кофе для дома».' : 'Торты, размеры и цены для витрины кондитерской.'} actions={<Button asChild><Link to={`${base}/new`}>Добавить {type === 'COFFEE' ? 'кофе' : 'торт'}</Link></Button>} />
    <Card><CardHeader><CardTitle>Все позиции</CardTitle><CardDescription>{products.data ? `${products.data.products.length} товаров` : 'Загружаем каталог…'}</CardDescription></CardHeader><CardContent className="admin-catalog-list">
      {products.data?.products.map((product) => <Link className="admin-catalog-row" key={product.id} params={{ productId: product.id }} to={`${base}/$productId`}><span className="admin-catalog-thumb">{product.imageUrl ? <img alt="" src={product.imageUrl} /> : <span>Фото</span>}</span><span><strong>{product.name}</strong><small>{product.subtitle || `${product.variants.length} ${variantWord(product.variants.length)}`}</small></span><span className={`admin-status admin-status-${product.status.toLowerCase()}`}>{statusLabel[product.status]}</span><b>{formatPrice(product)}</b></Link>)}
      {!products.isPending && products.data?.products.length === 0 ? <p className="admin-empty-copy">Здесь пока ничего нет. Добавьте первую позицию — она сохранится как черновик.</p> : null}
      {products.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить каталог.</p> : null}
    </CardContent></Card>
  </section>
}

function ProductEditor({ type, mode, productId }: { type: ProductType; mode: 'create' | 'edit'; productId?: string }) {
  const { api } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient(); const products = useProducts(type)
  const selected = products.data?.products.find((product) => product.id === productId)
  const [draft, setDraft] = useState<UpsertProductRequest>(empty(type))
  useEffect(() => { if (mode === 'edit' && selected) setDraft(toDraft(selected)) }, [mode, selected])
  const change = <K extends keyof UpsertProductRequest>(key: K, value: UpsertProductRequest[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const base = type === 'COFFEE' ? '/products/coffee' : '/products/cakes'
  const save = useMutation({ mutationFn: () => api.request(mode === 'edit' ? `/api/admin/products/${productId}` : '/api/admin/products', productResponseSchema, { method: mode === 'edit' ? 'PUT' : 'POST', body: upsertProductRequestSchema.parse(normalizeDraft({ ...draft, slug: draft.slug || toPublicSlug(draft.name) })) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); await navigate({ to: base }) } })
  const remove = useMutation({
    mutationFn: () => api.request(`/api/admin/products/${productId}`, productDeleteResponseSchema, { method: 'DELETE' }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); await navigate({ to: base }) },
  })

  if (mode === 'edit' && products.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем товар…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Витрина" title="Товар не найден" description="Возможно, он был удалён или адрес устарел." actions={<Button asChild variant="outline"><Link to={base}>Вернуться к списку</Link></Button>} /></section>

  return <section className="admin-page admin-page-editor">
    <AdminPageHeader eyebrow={type === 'COFFEE' ? 'Кофе' : 'Кондитерская'} title={mode === 'create' ? `Новая позиция` : selected?.name ?? 'Редактирование'} description="Заполните понятные гостю данные. Технические настройки спрятаны в конце формы." actions={<Button asChild variant="outline"><Link to={base}>К списку</Link></Button>} />
    <Card className="admin-editor-surface"><CardHeader><CardTitle>Карточка товара</CardTitle><CardDescription>Название, фото и цена — минимум, необходимый для понятной карточки.</CardDescription></CardHeader><CardContent><form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <AdminFormIntro>Сначала сохраните черновик. Опубликовать позицию можно, когда фото и цены проверены.</AdminFormIntro>
      <div className="admin-form-grid-2"><AdminField label="Название" hint={type === 'COFFEE' ? 'Например: Эфиопия Гуджи' : 'Например: Медовик'} required><Input required placeholder={type === 'COFFEE' ? 'Эфиопия Гуджи' : 'Медовик'} value={draft.name} onChange={(event) => change('name', event.target.value)} /></AdminField><AdminField label="Короткая подпись" hint="Одна строка под названием в карточке"><Input placeholder={type === 'COFFEE' ? 'Яркий кофе для фильтра' : 'Нежный мёд и сметанный крем'} value={draft.subtitle ?? ''} onChange={(event) => change('subtitle', nullable(event.target.value))} /></AdminField></div>
      {type === 'CAKE' ? <AdminField label="Категория" hint="Используется в навигации слева на странице кондитерской" required><Input required placeholder="Торты" value={draft.category ?? ''} onChange={(event) => change('category', nullable(event.target.value))} /></AdminField> : null}
      <AdminField label="Описание" hint="Расскажите о вкусе и особенностях — 2–4 предложения"><Textarea className="min-h-28" placeholder="Что почувствует гость и чем эта позиция отличается…" value={draft.description ?? ''} onChange={(event) => change('description', nullable(event.target.value))} /></AdminField>
      <div className="admin-form-grid-2"><AdminField label="Основное изображение" hint="Вставьте ссылку из медиатеки"><Input type="url" placeholder="https://…" value={draft.imageUrl ?? ''} onChange={(event) => change('imageUrl', nullable(event.target.value))} /></AdminField><AdminField label="Состав" hint="Ингредиенты через запятую"><Textarea placeholder="Кофе арабика 100%…" value={draft.ingredients ?? ''} onChange={(event) => change('ingredients', nullable(event.target.value))} /></AdminField></div>
      {type === 'COFFEE' ? <div className="admin-form-grid-2"><AdminField label="Происхождение" hint="Страна и регион"><Input placeholder="Эфиопия, регион Гуджи" value={draft.origin ?? ''} onChange={(event) => change('origin', nullable(event.target.value))} /></AdminField><AdminField label="Степень обжарки" hint="Например: светлая или средняя"><Input placeholder="Светлая" value={draft.roastLevel ?? ''} onChange={(event) => change('roastLevel', nullable(event.target.value))} /></AdminField></div> : null}
      <AdminField label="Вкусовые ноты" hint="Перечислите через запятую"><Input placeholder="Абрикос, молочный шоколад, сухофрукты" value={draft.tastingNotes.join(', ')} onChange={(event) => change('tastingNotes', event.target.value.split(/, ?/))} /></AdminField>
      <VariantEditor draft={draft} onChange={(variants) => change('variants', variants)} type={type} />
      <details className="admin-advanced-fields"><summary>Дополнительные настройки</summary><div className="admin-form-stack pt-4"><div className="admin-form-grid-2"><AdminField label="Адрес страницы" hint="Заполнится автоматически по названию. Меняйте только при необходимости."><Input placeholder="ethiopia-guji" value={draft.slug} onChange={(event) => change('slug', event.target.value)} /></AdminField><AdminField label="Статус"><select value={draft.status} onChange={(event) => change('status', event.target.value as UpsertProductRequest['status'])}><option value="DRAFT">Черновик — не виден на сайте</option><option value="PUBLISHED">Опубликован</option><option value="ARCHIVED">Архив</option></select></AdminField></div><AdminField label="Другие фотографии" hint="По одной ссылке из медиатеки в строке"><Textarea placeholder={'https://…\nhttps://…'} value={draft.galleryUrls.join('\n')} onChange={(event) => change('galleryUrls', event.target.value.split('\n'))} /></AdminField><AdminField label="Характеристики" hint="Одна строка — одна пара: название | значение"><Textarea placeholder={'Способ обработки | Мытый\nВысота произрастания | 1800 м'} value={draft.details.map((item) => `${item.label} | ${item.value}`).join('\n')} onChange={(event) => change('details', event.target.value.split('\n').map((line) => { const [label = '', value = ''] = line.split(/\s*\|\s*/, 2); return { label, value } }))} /></AdminField><AdminField label="Порядок отображения" hint="Меньшее число показывается раньше. Обычно менять не нужно."><Input min={0} type="number" value={draft.position} onChange={(event) => change('position', Number(event.target.value))} /></AdminField></div></details>
      <label className="admin-check-row"><input checked={draft.isFeatured} type="checkbox" onChange={(event) => change('isFeatured', event.target.checked)} /><span><strong>Показывать среди избранных</strong><small>Товар сможет появляться в рекомендованных блоках.</small></span></label>
      {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить. Проверьте обязательные поля, адрес страницы и цены.</p> : null}<div className="admin-form-actions"><Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить товар'}</Button></div>
    </form></CardContent></Card>
    {mode === 'edit' ? <Card className="admin-danger-zone"><CardHeader><CardTitle>Удаление товара</CardTitle><CardDescription>Товар исчезнет из витрины и связанных блоков. Это действие нельзя отменить.</CardDescription></CardHeader><CardContent><Button disabled={remove.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить «${selected?.name}»?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить товар'}</Button>{remove.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить товар.</p> : null}</CardContent></Card> : null}
  </section>
}

function VariantEditor({ draft, onChange, type }: { draft: UpsertProductRequest; onChange: (variants: UpsertProductRequest['variants']) => void; type: ProductType }) {
  return <section className="admin-variant-editor"><header><div><strong>Варианты и цены</strong><p>{type === 'COFFEE' ? 'Добавьте доступные фасовки: например, 250 г и 1 кг.' : 'Добавьте размеры или вес торта, которые можно заказать.'}</p></div><Button type="button" variant="outline" onClick={() => onChange([...draft.variants, { label: 'Новый вариант', weightGrams: null, priceKopecks: 0, position: (draft.variants.length + 1) * 10, isAvailable: true }])}>Добавить вариант</Button></header>{draft.variants.map((variant, index) => <div className="admin-variant-row" key={index}><AdminField label="Название" hint="Как увидит гость"><Input aria-label="Название варианта" placeholder="250 г" value={variant.label} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></AdminField><AdminField label="Вес, г"><Input min={1} placeholder="250" type="number" value={variant.weightGrams ?? ''} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, weightGrams: event.target.value ? Number(event.target.value) : null } : item))} /></AdminField><AdminField label="Цена, ₽"><Input min={0} placeholder="0" type="number" value={variant.priceKopecks / 100} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, priceKopecks: Number(event.target.value) * 100 } : item))} /></AdminField><label className="admin-compact-check"><input checked={variant.isAvailable} type="checkbox" onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, isAvailable: event.target.checked } : item))} /> В продаже</label><Button disabled={draft.variants.length === 1} type="button" variant="ghost" onClick={() => onChange(draft.variants.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button></div>)}</section>
}

function toDraft(product: Product): UpsertProductRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, variants, ...rest } = product; return { ...rest, variants: variants.map(({ id: _variantId, ...variant }) => variant) } }
function normalizeDraft(draft: UpsertProductRequest): UpsertProductRequest {
  return {
    ...draft,
    tastingNotes: draft.tastingNotes.map((value) => value.trim()).filter(Boolean),
    galleryUrls: draft.galleryUrls.map((value) => value.trim()).filter(Boolean),
    details: draft.details
      .map(({ label, value }) => ({ label: label.trim(), value: value.trim() }))
      .filter(({ label, value }) => label !== '' || value !== ''),
  }
}
function formatPrice(product: Product) { const prices = product.variants.map((variant) => variant.priceKopecks).filter(Boolean); return prices.length ? `от ${Math.min(...prices) / 100} ₽` : 'Цена не указана' }
function variantWord(value: number) { return value === 1 ? 'вариант' : value < 5 ? 'варианта' : 'вариантов' }
const statusLabel = { DRAFT: 'Черновик', PUBLISHED: 'Опубликован', ARCHIVED: 'Архив' } as const
