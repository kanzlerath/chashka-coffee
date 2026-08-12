import { adminBulkUpdateRequestSchema, adminBulkUpdateResponseSchema, productDeleteResponseSchema, productListResponseSchema, productResponseSchema, upsertProductRequestSchema, type Product, type ProductType, type UpsertProductRequest } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { AdminBulkBar, AdminDraftRecovery, AdminField, AdminFormIntro, AdminListToolbar, AdminPageHeader, AdminPublicationPanel, publicationOptions } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { AdminImageField, AdminImageListField } from '@/features/media-admin'
import { nullableDraftText } from '@/lib/form-drafts'
import { useEditorDraft } from '@/hooks/use-editor-draft'
import { toPublicSlug } from '@/lib/slugify'
import { BlockEditor } from '@/features/content-admin'

type ProductsPageProps = { type: ProductType; mode?: 'list' | 'create' | 'edit'; productId?: string }
const nullable = nullableDraftText
const emptyCoffee = (): UpsertProductRequest => ({ type: 'COFFEE', status: 'DRAFT', publishAt: null, slug: '', name: '', category: null, subtitle: null, description: null, ingredients: null, origin: null, roastLevel: null, tastingNotes: [], imageUrl: null, imageCrop: null, galleryUrls: [], details: [], blocks: [], isFeatured: false, position: 10, variants: [{ label: '250 г', weightGrams: 250, priceKopecks: 0, position: 10, isAvailable: true }] })
const emptyCake = (): UpsertProductRequest => ({ type: 'CAKE', status: 'DRAFT', publishAt: null, slug: '', name: '', category: 'Торты', subtitle: null, description: null, ingredients: null, origin: null, roastLevel: null, tastingNotes: [], imageUrl: null, imageCrop: null, galleryUrls: [], details: [], blocks: [], isFeatured: false, position: 10, variants: [{ label: '1 кг', weightGrams: 1000, priceKopecks: 0, position: 10, isAvailable: true }] })

export function ProductsPage({ type, mode = 'list', productId }: ProductsPageProps) {
  if (mode === 'list') return <ProductList type={type} />
  return type === 'COFFEE' ? <CoffeeProductEditor mode={mode} productId={productId} /> : <CakeProductEditor mode={mode} productId={productId} />
}

function useProducts(type: ProductType) {
  const { api } = useAuth()
  return useQuery({ queryKey: ['admin', 'products', type], queryFn: () => api.request(`/api/admin/products?type=${type}`, productListResponseSchema) })
}

function ProductList({ type }: { type: ProductType }) {
  const products = useProducts(type); const { api } = useAuth(); const queryClient = useQueryClient()
  const noun = type === 'COFFEE' ? 'Кофе' : 'Торты'
  const base = type === 'COFFEE' ? '/products/coffee' : '/products/cakes'
  const requestedStatus = new URLSearchParams(window.location.search).get('status')
  const initialStatus = requestedStatus && ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].includes(requestedStatus) ? requestedStatus as Product['status'] : 'ALL'
  const [query, setQuery] = useState(''); const [status, setStatus] = useState<'ALL' | Product['status']>(initialStatus); const [selectedIds, setSelectedIds] = useState<string[]>([]); const [bulkStatus, setBulkStatus] = useState<Product['status']>('PUBLISHED')
  const visible = useMemo(() => { const needle = query.trim().toLocaleLowerCase('ru-RU'); return products.data?.products.filter((product) => (status === 'ALL' || product.status === status) && (!needle || `${product.name} ${product.subtitle ?? ''} ${product.category ?? ''}`.toLocaleLowerCase('ru-RU').includes(needle))) ?? [] }, [products.data, query, status])
  const bulkUpdate = useMutation({ mutationFn: () => api.request('/api/admin/workspace/bulk-status', adminBulkUpdateResponseSchema, { method: 'POST', body: adminBulkUpdateRequestSchema.parse({ resource: 'PRODUCT', ids: selectedIds, status: bulkStatus }) }), onSuccess: () => { setSelectedIds([]); void queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] }) } })
  const toggle = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id])
  return <section className="admin-page">
    <AdminPageHeader eyebrow="Витрина" title={noun} description={type === 'COFFEE' ? 'Зерно и варианты фасовки, которые показываются в разделе «Кофе для дома».' : 'Торты, размеры и цены для витрины кондитерской.'} actions={<>{type === 'CAKE' ? <Button asChild variant="outline"><Link to="/products/cakes/import">Импортировать Excel</Link></Button> : null}<Button asChild><Link to={`${base}/new`}>Добавить {type === 'COFFEE' ? 'кофе' : 'торт'}</Link></Button></>} />
    <AdminListToolbar query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} statusOptions={[{ value: 'ALL', label: 'Все статусы' }, { value: 'DRAFT', label: 'Черновики' }, { value: 'SCHEDULED', label: 'Запланировано' }, { value: 'PUBLISHED', label: 'Опубликовано' }, { value: 'ARCHIVED', label: 'Архив' }]} placeholder="Название, категория…" />
    <AdminBulkBar count={selectedIds.length} action={bulkStatus} onActionChange={setBulkStatus} options={[{ value: 'DRAFT', label: 'В черновики' }, { value: 'PUBLISHED', label: 'Опубликовать' }, { value: 'ARCHIVED', label: 'В архив' }]} pending={bulkUpdate.isPending} onApply={() => bulkUpdate.mutate()} onClear={() => setSelectedIds([])} />
    <Card><CardHeader><CardTitle>Все позиции</CardTitle><CardDescription>{products.data ? `${visible.length} из ${products.data.products.length}` : 'Загружаем каталог…'}</CardDescription></CardHeader><CardContent className="admin-catalog-list">
      {visible.map((product) => <article className="admin-selectable-row" key={product.id}><input aria-label={`Выбрать ${product.name}`} checked={selectedIds.includes(product.id)} type="checkbox" onChange={() => toggle(product.id)} /><Link className="admin-catalog-row" params={{ productId: product.id }} to={`${base}/$productId`}><span className="admin-catalog-thumb">{product.imageUrl ? <img alt="" src={product.imageUrl} /> : <span>Фото</span>}</span><span><strong>{product.name}</strong><small>{product.subtitle || `${product.variants.length} ${variantWord(product.variants.length)}`}</small></span><span className={`admin-status admin-status-${product.status.toLowerCase()}`}>{statusLabel[product.status]}</span><b>{formatPrice(product)}</b></Link></article>)}
      {!products.isPending && products.data?.products.length === 0 ? <p className="admin-empty-copy">Здесь пока ничего нет. Добавьте первую позицию — она сохранится как черновик.</p> : null}
      {products.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить каталог.</p> : null}
      {bulkUpdate.isError ? <p className="admin-state-message admin-state-error">Не удалось обновить выбранные товары.</p> : null}
    </CardContent></Card>
  </section>
}

function CoffeeProductEditor({ mode, productId }: { mode: 'create' | 'edit'; productId?: string }) {
  const type = 'COFFEE' as const
  const { api } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient(); const products = useProducts(type)
  const selected = products.data?.products.find((product) => product.id === productId)
  const editor = useEditorDraft<UpsertProductRequest>({ key: `product:${productId ?? `new:${type}`}`, initialValue: selected ? toDraft(selected) : emptyCoffee(), sourceVersion: selected?.updatedAt ?? (mode === 'create' ? 'new' : 'loading'), enabled: mode === 'create' || Boolean(selected) })
  const { draft, setDraft } = editor
  const change = <K extends keyof UpsertProductRequest>(key: K, value: UpsertProductRequest[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const changeStatus = (status: UpsertProductRequest['status']) => setDraft((current) => ({ ...current, status, publishAt: status === 'SCHEDULED' ? current.publishAt ?? new Date(Date.now() + 3_600_000).toISOString() : null }))
  const base = type === 'COFFEE' ? '/products/coffee' : '/products/cakes'
  const save = useMutation({ mutationFn: () => { const input = upsertProductRequestSchema.parse(normalizeDraft({ ...draft, slug: draft.slug || toPublicSlug(draft.name) })); return api.request(mode === 'edit' ? `/api/admin/products/${productId}` : '/api/admin/products', productResponseSchema, { method: mode === 'edit' ? 'PUT' : 'POST', body: input }) }, onSuccess: async ({ product }) => { editor.markSaved(toDraft(product)); await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); await queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] }); await navigate({ to: base }) } })
  const remove = useMutation({
    mutationFn: () => api.request(`/api/admin/products/${productId}`, productDeleteResponseSchema, { method: 'DELETE' }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); await navigate({ to: base }) },
  })
  const copy = useMutation({
    mutationFn: () => api.request(`/api/admin/products/${productId}/copy`, productResponseSchema, { method: 'POST' }),
    onSuccess: async ({ product }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] })
      await navigate({ to: `${base}/$productId`, params: { productId: product.id } })
    },
  })

  if (mode === 'edit' && products.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем товар…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Витрина" title="Товар не найден" description="Возможно, он был удалён или адрес устарел." actions={<Button asChild variant="outline"><Link to={base}>Вернуться к списку</Link></Button>} /></section>

  const formId = 'product-editor-form'
  return <section className="admin-page admin-page-editor">
    <AdminPageHeader eyebrow={type === 'COFFEE' ? 'Кофе' : 'Кондитерская'} title={mode === 'create' ? `Новая позиция` : selected?.name ?? 'Редактирование'} description="Заполните понятные гостю данные. Технические настройки спрятаны в конце формы." actions={<><Button asChild variant="outline"><Link to={base}>К списку</Link></Button>{mode === 'edit' ? <Button disabled={copy.isPending || editor.isDirty} title={editor.isDirty ? 'Сначала сохраните изменения' : undefined} variant="outline" onClick={() => copy.mutate()}>{copy.isPending ? 'Копируем…' : 'Создать копию'}</Button> : null}</>} />
    {copy.isError ? <p className="admin-state-message admin-state-error">Не удалось создать копию. Повторите ещё раз.</p> : null}
    {editor.recovery ? <AdminDraftRecovery savedAt={editor.recovery.savedAt} onRestore={editor.restore} onDiscard={editor.discardRecovery} /> : null}
    <div className="admin-editor-layout"><Card className="admin-editor-surface"><CardHeader><CardTitle>Карточка товара</CardTitle><CardDescription>Название, фото и цена — минимум, необходимый для понятной карточки.</CardDescription></CardHeader><CardContent><form className="admin-form-stack" id={formId} onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <AdminFormIntro>Сначала сохраните черновик. Опубликовать позицию можно, когда фото и цены проверены.</AdminFormIntro>
      <div className="admin-form-grid-2"><AdminField label="Название" hint={type === 'COFFEE' ? 'Например: Эфиопия Гуджи' : 'Например: Медовик'} required><Input required placeholder={type === 'COFFEE' ? 'Эфиопия Гуджи' : 'Медовик'} value={draft.name} onChange={(event) => change('name', event.target.value)} /></AdminField><AdminField label="Короткая подпись" hint="Одна строка под названием в карточке"><Input placeholder={type === 'COFFEE' ? 'Яркий кофе для фильтра' : 'Нежный мёд и сметанный крем'} value={draft.subtitle ?? ''} onChange={(event) => change('subtitle', nullable(event.target.value))} /></AdminField></div>
      <AdminField label="Описание" hint="Расскажите о вкусе и особенностях — 2–4 предложения"><Textarea className="min-h-28" placeholder="Что почувствует гость и чем эта позиция отличается…" value={draft.description ?? ''} onChange={(event) => change('description', nullable(event.target.value))} /></AdminField>
      <AdminField label="Основное изображение" hint="Используется в карточке и на странице товара. После выбора кликните по объекту, который должен быть в центре карточки."><AdminImageField cardCrop imageCrop={draft.imageCrop} value={draft.imageUrl ?? null} onChange={(imageUrl) => setDraft((current) => ({ ...current, imageUrl, imageCrop: null }))} onImageCropChange={(imageCrop) => change('imageCrop', imageCrop)} /></AdminField><AdminField label="Состав" hint="Ингредиенты через запятую"><Textarea placeholder="Кофе арабика 100%…" value={draft.ingredients ?? ''} onChange={(event) => change('ingredients', nullable(event.target.value))} /></AdminField>
      {type === 'COFFEE' ? <div className="admin-form-grid-2"><AdminField label="Происхождение" hint="Страна и регион"><Input placeholder="Эфиопия, регион Гуджи" value={draft.origin ?? ''} onChange={(event) => change('origin', nullable(event.target.value))} /></AdminField><AdminField label="Степень обжарки" hint="Например: светлая или средняя"><Input placeholder="Светлая" value={draft.roastLevel ?? ''} onChange={(event) => change('roastLevel', nullable(event.target.value))} /></AdminField></div> : null}
      <AdminField label="Вкусовые ноты" hint="Перечислите через запятую"><Input placeholder="Абрикос, молочный шоколад, сухофрукты" value={draft.tastingNotes.join(', ')} onChange={(event) => change('tastingNotes', event.target.value.split(/, ?/))} /></AdminField>
      <CoffeeVariantEditor draft={draft} onChange={(variants) => change('variants', variants)} />
      <BlockEditor blocks={draft.blocks} preview={{ title: draft.name, excerpt: draft.description, imageUrl: draft.imageUrl }} onChange={(blocks) => change('blocks', blocks)} />
      <details className="admin-advanced-fields"><summary>Дополнительные настройки</summary><div className="admin-form-stack pt-4"><AdminField label="Адрес страницы" hint="Заполнится автоматически по названию. Меняйте только при необходимости."><Input placeholder="ethiopia-guji" value={draft.slug} onChange={(event) => change('slug', event.target.value)} /></AdminField><AdminField label="Другие фотографии" hint="До 12 фотографий; порядок можно менять."><AdminImageListField value={draft.galleryUrls} onChange={(galleryUrls) => change('galleryUrls', galleryUrls)} /></AdminField><AdminField label="Характеристики" hint="Одна строка — одна пара: название | значение"><Textarea placeholder={'Способ обработки | Мытый\nВысота произрастания | 1800 м'} value={draft.details.map((item) => `${item.label} | ${item.value}`).join('\n')} onChange={(event) => change('details', event.target.value.split('\n').map((line) => { const [label = '', value = ''] = line.split(/\s*\|\s*/, 2); return { label, value } }))} /></AdminField><AdminField label="Порядок отображения" hint="Меньшее число показывается раньше. Обычно менять не нужно."><Input min={0} type="number" value={draft.position} onChange={(event) => change('position', Number(event.target.value))} /></AdminField></div></details>
      <label className="admin-check-row"><input checked={draft.isFeatured} type="checkbox" onChange={(event) => change('isFeatured', event.target.checked)} /><span><strong>Показывать среди избранных</strong><small>Товар сможет появляться в рекомендованных блоках.</small></span></label>
      {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить. Проверьте обязательные поля, адрес страницы и цены.</p> : null}
    </form></CardContent></Card>
    <AdminPublicationPanel formId={formId} status={draft.status} options={[...publicationOptions]} onStatusChange={changeStatus} scheduleAt={draft.publishAt} onScheduleAtChange={(value) => change('publishAt', value)} isDirty={editor.isDirty} isSaving={save.isPending} savedAt={selected?.updatedAt} saveLabel="Сохранить товар" preview={{ eyebrow: type === 'COFFEE' ? 'Кофе для дома' : 'Кондитерская', title: draft.name, description: draft.subtitle ?? draft.description, imageUrl: draft.imageUrl, badge: statusLabel[draft.status], meta: [draft.origin, draft.roastLevel, draft.variants[0] ? `${draft.variants[0].priceKopecks / 100} ₽` : null] }} /></div>
    {mode === 'edit' ? <Card className="admin-danger-zone"><CardHeader><CardTitle>Удаление товара</CardTitle><CardDescription>Товар исчезнет из витрины и связанных блоков. Это действие нельзя отменить.</CardDescription></CardHeader><CardContent><Button disabled={remove.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить «${selected?.name}»?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить товар'}</Button>{remove.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить товар.</p> : null}</CardContent></Card> : null}
  </section>
}

function CakeProductEditor({ mode, productId }: { mode: 'create' | 'edit'; productId?: string }) {
  const type = 'CAKE' as const
  const { api } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient(); const products = useProducts(type)
  const selected = products.data?.products.find((product) => product.id === productId)
  const editor = useEditorDraft<UpsertProductRequest>({ key: `cake:${productId ?? 'new'}`, initialValue: selected ? toCakeDraft(selected) : emptyCake(), sourceVersion: selected?.updatedAt ?? (mode === 'create' ? 'new' : 'loading'), enabled: mode === 'create' || Boolean(selected) })
  const { draft, setDraft } = editor
  const change = <K extends keyof UpsertProductRequest>(key: K, value: UpsertProductRequest[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const changeStatus = (status: UpsertProductRequest['status']) => setDraft((current) => ({ ...current, status, publishAt: status === 'SCHEDULED' ? current.publishAt ?? new Date(Date.now() + 3_600_000).toISOString() : null }))
  const base = '/products/cakes'
  const save = useMutation({ mutationFn: () => {
    const input = upsertProductRequestSchema.parse(normalizeCakeDraft({ ...draft, slug: draft.slug || toPublicSlug(draft.name) }))
    return api.request(mode === 'edit' ? `/api/admin/products/${productId}` : '/api/admin/products', productResponseSchema, { method: mode === 'edit' ? 'PUT' : 'POST', body: input })
  }, onSuccess: async ({ product }) => {
    editor.markSaved(toCakeDraft(product)); await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); await queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] }); await navigate({ to: base })
  } })
  const remove = useMutation({
    mutationFn: () => api.request(`/api/admin/products/${productId}`, productDeleteResponseSchema, { method: 'DELETE' }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); await navigate({ to: base }) },
  })
  const copy = useMutation({
    mutationFn: () => api.request(`/api/admin/products/${productId}/copy`, productResponseSchema, { method: 'POST' }),
    onSuccess: async ({ product }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products', type] }); await queryClient.invalidateQueries({ queryKey: ['admin', 'workspace'] }); await navigate({ to: `${base}/$productId`, params: { productId: product.id } })
    },
  })

  if (mode === 'edit' && products.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем торт…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Кондитерская" title="Торт не найден" description="Возможно, он был удалён или адрес устарел." actions={<Button asChild variant="outline"><Link to={base}>Вернуться к списку</Link></Button>} /></section>

  const formId = 'cake-editor-form'
  return <section className="admin-page admin-page-editor">
    <AdminPageHeader eyebrow="Кондитерская" title={mode === 'create' ? 'Новый торт' : selected?.name ?? 'Редактирование торта'} description="Название, состав, фото, размеры и цены — всё, что нужно для карточки торта." actions={<><Button asChild variant="outline"><Link to={base}>К тортам</Link></Button>{mode === 'edit' ? <Button disabled={copy.isPending || editor.isDirty} title={editor.isDirty ? 'Сначала сохраните изменения' : undefined} variant="outline" onClick={() => copy.mutate()}>{copy.isPending ? 'Копируем…' : 'Создать копию'}</Button> : null}</>} />
    {copy.isError ? <p className="admin-state-message admin-state-error">Не удалось создать копию. Повторите ещё раз.</p> : null}
    {editor.recovery ? <AdminDraftRecovery savedAt={editor.recovery.savedAt} onRestore={editor.restore} onDiscard={editor.discardRecovery} /> : null}
    <div className="admin-editor-layout"><Card className="admin-editor-surface"><CardHeader><CardTitle>Карточка торта</CardTitle><CardDescription>Заполните данные так, как их увидит гость на витрине кондитерской.</CardDescription></CardHeader><CardContent><form className="admin-form-stack" id={formId} onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <AdminFormIntro>Сначала сохраните черновик. Публикуйте торт, когда проверены фото, размеры и цены.</AdminFormIntro>
      <div className="admin-form-grid-2"><AdminField label="Название торта" hint="Например: Медовик" required><Input required placeholder="Медовик" value={draft.name} onChange={(event) => change('name', event.target.value)} /></AdminField><AdminField label="Короткое описание" hint="Одна строка под названием в карточке"><Input placeholder="Нежный мёд и сметанный крем" value={draft.subtitle ?? ''} onChange={(event) => change('subtitle', nullable(event.target.value))} /></AdminField></div>
      <AdminField label="Категория витрины" hint="Используется в навигации страницы кондитерской" required><Input required placeholder="Торты" value={draft.category ?? ''} onChange={(event) => change('category', nullable(event.target.value))} /></AdminField>
      <AdminField label="Описание торта" hint="Расскажите о коржах, креме, декоре и вкусе — 2–4 предложения"><Textarea className="min-h-28" placeholder="Медовые коржи, сметанный крем и лёгкая карамельная нота…" value={draft.description ?? ''} onChange={(event) => change('description', nullable(event.target.value))} /></AdminField>
      <AdminField label="Основное изображение" hint="Используется в карточке и на странице торта. После выбора кликните по объекту, который должен быть в центре карточки."><AdminImageField cardCrop imageCrop={draft.imageCrop} value={draft.imageUrl ?? null} onChange={(imageUrl) => setDraft((current) => ({ ...current, imageUrl, imageCrop: null }))} onImageCropChange={(imageCrop) => change('imageCrop', imageCrop)} /></AdminField>
      <AdminField label="Состав" hint="Ингредиенты через запятую"><Textarea placeholder="Мука, мёд, сметана, сливочное масло…" value={draft.ingredients ?? ''} onChange={(event) => change('ingredients', nullable(event.target.value))} /></AdminField>
      <CakeVariantEditor draft={draft} onChange={(variants) => change('variants', variants)} />
      <BlockEditor blocks={draft.blocks} preview={{ title: draft.name, excerpt: draft.description, imageUrl: draft.imageUrl }} onChange={(blocks) => change('blocks', blocks)} />
      <details className="admin-advanced-fields"><summary>Дополнительные сведения</summary><div className="admin-form-stack pt-4"><AdminField label="Адрес страницы" hint="Заполнится автоматически по названию. Меняйте только при необходимости."><Input placeholder="medovik" value={draft.slug} onChange={(event) => change('slug', event.target.value)} /></AdminField><AdminField label="Другие фотографии" hint="До 12 фотографий; порядок можно менять."><AdminImageListField value={draft.galleryUrls} onChange={(galleryUrls) => change('galleryUrls', galleryUrls)} /></AdminField><AdminField label="Сведения о торте" hint="Одна строка — одна пара: название | значение"><Textarea placeholder={'Диаметр | 18 см\nСрок хранения | 72 часа'} value={draft.details.map((item) => `${item.label} | ${item.value}`).join('\n')} onChange={(event) => change('details', event.target.value.split('\n').map((line) => { const [label = '', value = ''] = line.split(/\s*\|\s*/, 2); return { label, value } }))} /></AdminField><AdminField label="Порядок отображения" hint="Меньшее число показывается раньше. Обычно менять не нужно."><Input min={0} type="number" value={draft.position} onChange={(event) => change('position', Number(event.target.value))} /></AdminField></div></details>
      <label className="admin-check-row"><input checked={draft.isFeatured} type="checkbox" onChange={(event) => change('isFeatured', event.target.checked)} /><span><strong>Показывать среди избранных</strong><small>Торт сможет появляться в рекомендованных блоках.</small></span></label>
      {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить. Проверьте обязательные поля, адрес страницы и цены.</p> : null}
    </form></CardContent></Card>
    <AdminPublicationPanel formId={formId} status={draft.status} options={[...publicationOptions]} onStatusChange={changeStatus} scheduleAt={draft.publishAt} onScheduleAtChange={(value) => change('publishAt', value)} isDirty={editor.isDirty} isSaving={save.isPending} savedAt={selected?.updatedAt} saveLabel="Сохранить торт" preview={{ eyebrow: 'Кондитерская', title: draft.name, description: draft.subtitle ?? draft.description, imageUrl: draft.imageUrl, badge: statusLabel[draft.status], meta: [draft.category, draft.variants[0] ? `${draft.variants[0].priceKopecks / 100} ₽` : null] }} /></div>
    {mode === 'edit' ? <Card className="admin-danger-zone"><CardHeader><CardTitle>Удаление торта</CardTitle><CardDescription>Торт исчезнет из витрины и связанных блоков. Это действие нельзя отменить.</CardDescription></CardHeader><CardContent><Button disabled={remove.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить «${selected?.name}»?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить торт'}</Button>{remove.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить торт.</p> : null}</CardContent></Card> : null}
  </section>
}

function CoffeeVariantEditor({ draft, onChange }: { draft: UpsertProductRequest; onChange: (variants: UpsertProductRequest['variants']) => void }) {
  return <section className="admin-variant-editor"><header><div><strong>Варианты и цены</strong><p>Добавьте доступные фасовки: например, 250 г и 1 кг.</p></div><Button type="button" variant="outline" onClick={() => onChange([...draft.variants, { label: 'Новый вариант', weightGrams: null, priceKopecks: 0, position: (draft.variants.length + 1) * 10, isAvailable: true }])}>Добавить вариант</Button></header>{draft.variants.map((variant, index) => <div className="admin-variant-row" key={index}><AdminField label="Название" hint="Как увидит гость"><Input aria-label="Название варианта" placeholder="250 г" value={variant.label} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></AdminField><AdminField label="Вес, г"><Input min={1} placeholder="250" type="number" value={variant.weightGrams ?? ''} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, weightGrams: event.target.value ? Number(event.target.value) : null } : item))} /></AdminField><AdminField label="Цена, ₽"><Input min={0} placeholder="0" type="number" value={variant.priceKopecks / 100} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, priceKopecks: Number(event.target.value) * 100 } : item))} /></AdminField><label className="admin-compact-check"><input checked={variant.isAvailable} type="checkbox" onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, isAvailable: event.target.checked } : item))} /> В продаже</label><Button disabled={draft.variants.length === 1} type="button" variant="ghost" onClick={() => onChange(draft.variants.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button></div>)}</section>
}

function CakeVariantEditor({ draft, onChange }: { draft: UpsertProductRequest; onChange: (variants: UpsertProductRequest['variants']) => void }) {
  return <section className="admin-variant-editor"><header><div><strong>Размеры и цены</strong><p>Добавьте варианты торта: например, «1 кг», «1,5 кг» или «Ø 18 см».</p></div><Button type="button" variant="outline" onClick={() => onChange([...draft.variants, { label: 'Новый размер', weightGrams: null, priceKopecks: 0, position: (draft.variants.length + 1) * 10, isAvailable: true }])}>Добавить размер</Button></header>{draft.variants.map((variant, index) => <div className="admin-variant-row" key={index}><AdminField label="Размер или вес" hint="Как увидит гость" required><Input aria-label="Размер или вес торта" placeholder="1 кг" value={variant.label} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></AdminField><AdminField label="Вес, г" hint="Необязательно"><Input min={1} placeholder="1000" type="number" value={variant.weightGrams ?? ''} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, weightGrams: event.target.value ? Number(event.target.value) : null } : item))} /></AdminField><AdminField label="Цена, ₽" required><Input min={0} placeholder="0" type="number" value={variant.priceKopecks / 100} onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, priceKopecks: Number(event.target.value) * 100 } : item))} /></AdminField><label className="admin-compact-check"><input checked={variant.isAvailable} type="checkbox" onChange={(event) => onChange(draft.variants.map((item, itemIndex) => itemIndex === index ? { ...item, isAvailable: event.target.checked } : item))} /> В продаже</label><Button disabled={draft.variants.length === 1} type="button" variant="ghost" onClick={() => onChange(draft.variants.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button></div>)}</section>
}

function toDraft(product: Product): UpsertProductRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, variants, ...rest } = product; return { ...rest, variants: variants.map(({ id: _variantId, ...variant }) => variant) } }
function toCakeDraft(product: Product): UpsertProductRequest { return { ...toDraft(product), type: 'CAKE', origin: null, roastLevel: null, tastingNotes: [] } }
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
function normalizeCakeDraft(draft: UpsertProductRequest): UpsertProductRequest { return { ...normalizeDraft(draft), type: 'CAKE', origin: null, roastLevel: null, tastingNotes: [] } }
function formatPrice(product: Product) { const prices = product.variants.map((variant) => variant.priceKopecks).filter(Boolean); return prices.length ? `от ${Math.min(...prices) / 100} ₽` : 'Цена не указана' }
function variantWord(value: number) { return value === 1 ? 'вариант' : value < 5 ? 'варианта' : 'вариантов' }
const statusLabel = { DRAFT: 'Черновик', SCHEDULED: 'Запланирован', PUBLISHED: 'Опубликован', ARCHIVED: 'Архив' } as const
