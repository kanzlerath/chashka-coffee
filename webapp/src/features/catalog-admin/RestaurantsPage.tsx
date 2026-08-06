import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminRestaurant, AdminRestaurantMenuDetailResponse, RestaurantOpeningHoursEntry, RestaurantScheduleException, RestaurantVisitAmenity, UpsertRestaurantMenuItemOverrideRequest, UpsertRestaurantRequest, UpsertRestaurantScheduleExceptionRequest } from '@chashka-coffee/contracts'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ZodError } from 'zod'

import { AdminDraftRecovery, AdminField, AdminFormIntro, AdminPageHeader, AdminTabs } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { AdminImageField, AdminImageListField } from '@/features/media-admin'
import { formatRussianPhone } from '@/lib/contact-fields'
import { nullableDraftText } from '@/lib/form-drafts'
import { useEditorDraft } from '@/hooks/use-editor-draft'
import { toPublicSlug } from '@/lib/slugify'
import { ApiRequestError } from '@/platform/api/http-client'
import { CatalogAdminApi } from './api'

const defaultHours: RestaurantOpeningHoursEntry[] = [
  { dayOfWeek: 0, opensAt: '08:00', closesAt: '22:00', isClosed: false },
  { dayOfWeek: 1, opensAt: '08:00', closesAt: '22:00', isClosed: false },
  { dayOfWeek: 2, opensAt: '08:00', closesAt: '22:00', isClosed: false },
  { dayOfWeek: 3, opensAt: '08:00', closesAt: '22:00', isClosed: false },
  { dayOfWeek: 4, opensAt: '08:00', closesAt: '22:00', isClosed: false },
  { dayOfWeek: 5, opensAt: '08:00', closesAt: '22:00', isClosed: false },
  { dayOfWeek: 6, opensAt: '08:00', closesAt: '22:00', isClosed: false },
]

const emptyRestaurant: UpsertRestaurantRequest = {
  slug: '', name: '', format: 'CITY', area: 'CITY', isAtApartHotel: false, coffeePickupEnabled: false,
  city: 'Новосибирск', address: '', phone: '', description: null, coverImageUrl: null,
  aboutTitle: 'О ресторане', aboutText: null, visitAmenities: [],
  galleryUrls: [], menuPdfUrl: null,
  latitude: null, longitude: null, yandexMapsUrl: null, twoGisUrl: null,
  openingHours: defaultHours,
}

type LocalMenuItem = AdminRestaurantMenuDetailResponse['categories'][number]['items'][number]
const emptyScheduleException = (): UpsertRestaurantScheduleExceptionRequest => ({ date: new Date().toISOString().slice(0, 10), label: '', opensAt: '08:00', closesAt: '22:00', isClosed: false })

export function RestaurantsPage({ mode = 'list', restaurantId }: { mode?: 'list' | 'create' | 'edit'; restaurantId?: string }) {
  const { api: authApi } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const api = useMemo(() => new CatalogAdminApi(authApi), [authApi])
  const [overrideItem, setOverrideItem] = useState<LocalMenuItem | null>(null)
  const [overrideDraft, setOverrideDraft] = useState<UpsertRestaurantMenuItemOverrideRequest>({ description: null, ingredients: null, weightGrams: null, measurementUnit: null, priceKopecks: null })
  const [scheduleDraft, setScheduleDraft] = useState<UpsertRestaurantScheduleExceptionRequest>(emptyScheduleException)
  const [editorTab, setEditorTab] = useState<'main' | 'about' | 'media' | 'map' | 'schedule' | 'menu'>('main')
  const restaurants = useQuery({ queryKey: ['admin', 'restaurants'], queryFn: () => api.listRestaurants() })
  const selected = mode === 'edit' ? restaurants.data?.restaurants.find((restaurant) => restaurant.id === restaurantId) ?? null : null
  const editor = useEditorDraft<UpsertRestaurantRequest>({ key: `restaurant:${restaurantId ?? 'new'}`, initialValue: selected ? restaurantToDraft(selected) : freshRestaurant(), sourceVersion: selected?.updatedAt ?? (mode === 'create' ? 'new' : 'loading'), enabled: mode !== 'list' && (mode === 'create' || Boolean(selected)) })
  const { draft, setDraft } = editor
  const menus = useQuery({ queryKey: ['admin', 'menus'], queryFn: () => api.listMenus() })
  const restaurantMenu = useQuery({ queryKey: ['admin', 'restaurant-menu', selected?.id], enabled: Boolean(selected?.id && selected.menuId), queryFn: () => api.getRestaurantMenuDetail(selected!.id) })
  const scheduleExceptions = useQuery({ queryKey: ['admin', 'restaurant-schedule-exceptions', selected?.id], enabled: Boolean(selected?.id), queryFn: () => api.listRestaurantScheduleExceptions(selected!.id) })

  useEffect(() => {
    setOverrideItem(null)
    setScheduleDraft(emptyScheduleException())
    setEditorTab('main')
  }, [mode, selected?.id])

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...draft,
        slug: draft.slug.trim() || toPublicSlug(draft.name),
        galleryUrls: normalizeRestaurantGalleryUrls(draft.galleryUrls),
      }
      return selected ? api.updateRestaurant(selected.id, payload) : api.createRestaurant(payload)
    },
    onSuccess: async (result) => {
      const savedDraft = restaurantToDraft(result.restaurant)
      editor.markSaved(savedDraft)
      setDraft(savedDraft)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
      if (mode === 'create') {
        await navigate({ to: '/restaurants/$restaurantId', params: { restaurantId: result.restaurant.id } })
      }
    },
  })
  const assignMenu = useMutation({
    mutationFn: (menuId: string | null) => api.assignRestaurantMenu(selected!.id, menuId),
    onSuccess: () => {
      setOverrideItem(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant-menu', selected?.id] })
    },
  })
  const saveOverride = useMutation({
    mutationFn: () => api.saveRestaurantMenuItemOverride(selected!.id, overrideItem!.id, overrideDraft),
    onSuccess: () => { setOverrideItem(null); void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant-menu', selected?.id] }) },
  })
  const resetOverride = useMutation({
    mutationFn: () => api.deleteRestaurantMenuItemOverride(selected!.id, overrideItem!.id),
    onSuccess: () => { setOverrideItem(null); void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant-menu', selected?.id] }) },
  })
  const saveScheduleException = useMutation({ mutationFn: () => api.saveRestaurantScheduleException(selected!.id, scheduleDraft), onSuccess: () => { setScheduleDraft(emptyScheduleException()); void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant-schedule-exceptions', selected?.id] }) } })
  const deleteScheduleException = useMutation({ mutationFn: (exceptionId: string) => api.deleteRestaurantScheduleException(selected!.id, exceptionId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant-schedule-exceptions', selected?.id] }) })
  const removeRestaurant = useMutation({ mutationFn: () => api.deleteRestaurant(selected!.id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] }); await navigate({ to: '/restaurants' }) } })

  function change<K extends keyof UpsertRestaurantRequest>(key: K, value: UpsertRestaurantRequest[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  function changeHours(dayOfWeek: number, patch: Partial<RestaurantOpeningHoursEntry>) {
    change('openingHours', draft.openingHours.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry))
  }
  function addVisitAmenity() {
    if (draft.visitAmenities.length >= 6) return
    change('visitAmenities', [...draft.visitAmenities, { iconUrl: '', title: '', description: '' }])
  }
  function changeVisitAmenity<K extends keyof RestaurantVisitAmenity>(index: number, key: K, value: RestaurantVisitAmenity[K]) {
    change('visitAmenities', draft.visitAmenities.map((amenity, amenityIndex) => amenityIndex === index ? { ...amenity, [key]: value } : amenity))
  }
  function removeVisitAmenity(index: number) {
    change('visitAmenities', draft.visitAmenities.filter((_, amenityIndex) => amenityIndex !== index))
  }

  if (mode === 'list') {
    return <section className="admin-page">
      <AdminPageHeader eyebrow="Каталог" title="Рестораны" description="Адреса, график работы и меню каждой точки сети." actions={<Button asChild><Link to="/restaurants/new">Добавить ресторан</Link></Button>} />
      <Card className="admin-directory-card">
        <CardHeader><CardTitle>Все рестораны</CardTitle></CardHeader>
        <CardContent className="admin-directory-list">
          {restaurants.isPending ? <p className="admin-empty-state">Загружаем рестораны…</p> : null}
          {restaurants.data?.restaurants.map((restaurant) => <Link key={restaurant.id} to="/restaurants/$restaurantId" params={{ restaurantId: restaurant.id }} className="admin-directory-row admin-directory-row-simple">
            <span className="admin-directory-main"><strong>{restaurant.name}</strong><small>{restaurant.address || 'Адрес пока не указан'}</small></span>
            <span className="admin-directory-meta"><span className="admin-status-pill">{formatLabel[restaurant.format]}</span><small>{restaurant.menuName ?? 'Меню не назначено'}</small></span>
            <span className="admin-row-action">Редактировать</span>
          </Link>)}
          {!restaurants.isPending && restaurants.data?.restaurants.length === 0 ? <p className="admin-empty-state">Ресторанов пока нет. Добавьте первую точку.</p> : null}
          {restaurants.isError ? <p className="text-sm text-destructive">Не удалось загрузить рестораны. Проверьте подключение к API и повторите попытку.</p> : null}
        </CardContent>
      </Card>
    </section>
  }

  if (mode === 'edit' && restaurants.isPending) return <section className="admin-page"><p className="admin-empty-state">Загружаем ресторан…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Каталог" title="Ресторан не найден" description="Возможно, точка была удалена или ссылка устарела." actions={<Button asChild variant="outline"><Link to="/restaurants">К списку</Link></Button>} /></section>

  return <section className="admin-page">
    <AdminPageHeader eyebrow="Рестораны" title={selected ? selected.name : 'Новый ресторан'} description={selected ? 'Изменяйте данные конкретной точки. Сохранение не затронет другие рестораны.' : 'Сначала заполните основные данные. График-исключения и локальное меню появятся после создания.'} actions={<Button asChild variant="outline"><Link to="/restaurants">К списку ресторанов</Link></Button>} />
    {editor.recovery ? <AdminDraftRecovery savedAt={editor.recovery.savedAt} onRestore={editor.restore} onDiscard={editor.discardRecovery} /> : null}
    <Card className="admin-editor-card admin-editor-card-wide"><CardHeader><CardTitle>{selected ? 'Настройки ресторана' : 'Основные данные'}</CardTitle><CardDescription>Поля с пометкой «обязательно» нужны для публикации точки на сайте.</CardDescription></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; save.mutate() }}>
        <AdminTabs label="Разделы ресторана" value={editorTab} onChange={setEditorTab} tabs={[{ value: 'main', label: 'Основное' }, { value: 'about', label: 'О ресторане' }, { value: 'media', label: 'Фото и PDF' }, { value: 'map', label: 'Карта' }, { value: 'schedule', label: 'График' }, { value: 'menu', label: 'Меню' }]} />
        {editorTab === 'main' ? <>
        <AdminFormIntro>Название, контакты и фотография — то, что увидит гость на странице ресторана.</AdminFormIntro>
        <AdminField label="Название ресторана" required hint="Например: Чашка кофе на Красном проспекте"><Input required placeholder="Чашка кофе на…" value={draft.name} onChange={(event) => change('name', event.target.value)} /></AdminField>
        <div className="grid gap-4 sm:grid-cols-2"><AdminField label="Тип ресторана" required hint="Выберите, где находится точка."><select value={draft.format} onChange={(event) => { const value = event.target.value as UpsertRestaurantRequest['format']; change('format', value); change('area', value === 'AIRPORT' ? 'AIRPORT' : 'CITY') }}><option value="CITY">В городе</option><option value="AIRPORT">В аэропорту</option></select></AdminField><AdminField label="Город" required><Input required placeholder="Новосибирск" value={draft.city} onChange={(event) => change('city', event.target.value)} /></AdminField></div>
        <AdminField label="Адрес" required hint="Полный адрес, который можно скопировать в навигатор."><Input required placeholder="Красный проспект, 25" value={draft.address} onChange={(event) => change('address', event.target.value)} /></AdminField>
        <AdminField label="Телефон" required hint="Показывается посетителям и используется для кнопки «Позвонить»."><Input required type="tel" inputMode="tel" pattern="\\+7 \\(\\d{3}\\) \\d{3}-\\d{2}-\\d{2}" placeholder="+7 (383) 123-20-20" value={draft.phone} onChange={(event) => change('phone', formatRussianPhone(event.target.value))} /></AdminField>
        <label className="admin-check-row"><input checked={draft.coffeePickupEnabled} type="checkbox" onChange={(event) => change('coffeePickupEnabled', event.target.checked)} /><span><strong>Выдавать онлайн-заказы кофе</strong><small>Точка появится в списке самовывоза при оформлении заказа.</small></span></label>
        <AdminField label="Короткое описание" hint="Два-три предложения об атмосфере, кухне или особенностях точки."><Textarea placeholder="Светлый городской ресторан для завтраков, встреч и неспешных ужинов." value={draft.description ?? ''} onChange={(event) => change('description', nullableDraftText(event.target.value))} /></AdminField>
        <AdminField label="Фотография ресторана" hint="Показывается в каталоге и в первом экране страницы ресторана."><AdminImageField value={draft.coverImageUrl ?? null} onChange={(coverImageUrl) => change('coverImageUrl', coverImageUrl)} /></AdminField>
        <details className="admin-advanced-fields"><summary>Технические настройки</summary><div className="pt-4"><AdminField label="Адрес страницы" hint="Можно не заполнять — адрес создастся автоматически из названия."><Input value={draft.slug} placeholder="krasny-prospekt" onChange={(event) => change('slug', event.target.value)} /></AdminField></div></details>
        </> : null}
        {editorTab === 'about' ? <>
        <AdminFormIntro>Этот текст расположен ниже контактов. Он не меняет короткое описание в первом экране, поэтому здесь можно подробнее рассказать именно об этой точке.</AdminFormIntro>
        <AdminField label="Заголовок блока" hint="Например: О ресторане или Место для встреч в центре."><Input maxLength={180} placeholder="О ресторане" value={draft.aboutTitle ?? ''} onChange={(event) => change('aboutTitle', nullableDraftText(event.target.value))} /></AdminField>
        <AdminField label="Текст о ресторане" hint="Можно использовать несколько абзацев — переносы строк сохранятся на сайте."><Textarea className="min-h-64" placeholder="Расскажите об интерьере, атмосфере и особенностях этой точки." value={draft.aboutText ?? ''} onChange={(event) => change('aboutText', nullableDraftText(event.target.value))} /></AdminField>
        <fieldset className="grid gap-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">Особенности перед визитом</legend>
          <p className="text-sm text-muted-foreground">Добавьте до шести особенностей. Для каждой нужна прямая ссылка на SVG, название и короткое пояснение. Порядок строк сохранится на сайте.</p>
          {draft.visitAmenities.map((amenity, index) => <div className="grid gap-3 rounded-lg border p-3" key={index}>
            <div className="flex items-center justify-between gap-3"><strong className="text-sm">Особенность {index + 1}</strong><Button type="button" size="sm" variant="ghost" onClick={() => removeVisitAmenity(index)}>Удалить</Button></div>
            <AdminField label="Ссылка на SVG"><Input placeholder="https://…/parking.svg или /images/parking.svg" value={amenity.iconUrl} onChange={(event) => changeVisitAmenity(index, 'iconUrl', event.target.value)} /></AdminField>
            <AdminField label="Название"><Input maxLength={100} placeholder="Парковка рядом" value={amenity.title} onChange={(event) => changeVisitAmenity(index, 'title', event.target.value)} /></AdminField>
            <AdminField label="Описание"><Textarea placeholder="Бесплатная парковка находится во дворе ресторана." value={amenity.description} onChange={(event) => changeVisitAmenity(index, 'description', event.target.value)} /></AdminField>
          </div>)}
          {draft.visitAmenities.length === 0 ? <p className="text-sm text-muted-foreground">Особенностей пока нет — блок на сайте будет скрыт.</p> : null}
          <Button className="w-fit" type="button" variant="outline" disabled={draft.visitAmenities.length >= 6} onClick={addVisitAmenity}>Добавить особенность</Button>
        </fieldset>
        </> : null}
        {editorTab === 'media' ? <>
        <AdminFormIntro>Обложка используется в первом экране, а галерея — в отдельном слайдере ниже. Добавляйте по одной прямой ссылке на фотографию в строке.</AdminFormIntro>
        <AdminField label="Фотографии галереи" hint="До 12 фотографий; порядок можно менять."><AdminImageListField value={draft.galleryUrls} onChange={(galleryUrls) => change('galleryUrls', galleryUrls)} /></AdminField>
        <AdminField label="PDF меню" hint="Прямая публичная ссылка на PDF-файл для кнопки скачивания."><Input type="url" placeholder="https://…/menu.pdf" value={draft.menuPdfUrl ?? ''} onChange={(event) => change('menuPdfUrl', nullableDraftText(event.target.value))} /></AdminField>
        </> : null}
        {editorTab === 'map' ? <>
        <AdminFormIntro>Добавьте ссылки на готовые карточки ресторана. Координаты нужны для собственной карты сайта.</AdminFormIntro>
        <div className="grid gap-4 sm:grid-cols-2"><AdminField label="Яндекс Карты" hint="Ссылка из кнопки «Поделиться» в Яндекс Картах."><Input type="url" placeholder="https://yandex.ru/maps/…" value={draft.yandexMapsUrl ?? ''} onChange={(event) => change('yandexMapsUrl', nullableDraftText(event.target.value))} /></AdminField><AdminField label="2ГИС" hint="Ссылка на карточку ресторана в 2ГИС."><Input type="url" placeholder="https://2gis.ru/…" value={draft.twoGisUrl ?? ''} onChange={(event) => change('twoGisUrl', nullableDraftText(event.target.value))} /></AdminField></div>
        <details className="admin-advanced-fields"><summary>Координаты для карты</summary><div className="grid gap-4 pt-4 sm:grid-cols-2"><AdminField label="Широта"><Input type="number" step="any" placeholder="55.0302" value={draft.latitude ?? ''} onChange={(event) => change('latitude', event.target.value === '' ? null : Number(event.target.value))} /></AdminField><AdminField label="Долгота"><Input type="number" step="any" placeholder="82.9204" value={draft.longitude ?? ''} onChange={(event) => change('longitude', event.target.value === '' ? null : Number(event.target.value))} /></AdminField></div></details>
        </> : null}
        {editorTab === 'schedule' ? <>
        <fieldset className="grid gap-2 rounded-xl border p-3"><legend className="px-1 text-sm font-medium">График работы</legend>{draft.openingHours.map((entry) => <div className="grid grid-cols-[74px_1fr_1fr_auto] items-center gap-2" key={entry.dayOfWeek}><span className="text-sm">{dayLabel[entry.dayOfWeek]}</span><Input aria-label={`Открытие, ${dayLabel[entry.dayOfWeek]}`} disabled={entry.isClosed} type="time" value={entry.opensAt ?? ''} onChange={(event) => changeHours(entry.dayOfWeek, { opensAt: event.target.value || null })} /><Input aria-label={`Закрытие, ${dayLabel[entry.dayOfWeek]}`} disabled={entry.isClosed} type="time" value={entry.closesAt ?? ''} onChange={(event) => changeHours(entry.dayOfWeek, { closesAt: event.target.value || null })} /><label className="flex items-center gap-1 text-xs"><input checked={entry.isClosed} type="checkbox" onChange={(event) => changeHours(entry.dayOfWeek, { isClosed: event.target.checked })} />выходной</label></div>)}</fieldset>
        {selected ? <ScheduleExceptions exceptions={scheduleExceptions.data?.exceptions ?? []} draft={scheduleDraft} loading={scheduleExceptions.isPending} saving={saveScheduleException.isPending || deleteScheduleException.isPending} error={scheduleExceptions.isError || saveScheduleException.isError || deleteScheduleException.isError} onChange={setScheduleDraft} onSave={() => saveScheduleException.mutate()} onDelete={(exceptionId) => deleteScheduleException.mutate(exceptionId)} /> : null}
        {!selected ? <p className="text-sm text-muted-foreground">Сначала сохраните ресторан, затем добавляйте отдельные исключения графика.</p> : null}
        </> : null}
        {editorTab === 'menu' ? <>
        {selected ? <AdminField label="Какое меню показывать" hint="Для ресторана используется один набор. Изменение применяется сразу."><select disabled={assignMenu.isPending || menus.isPending} value={selected.menuId ?? ''} onChange={(event) => assignMenu.mutate(event.target.value || null)}><option value="">Меню не назначено</option>{menus.data?.menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></AdminField> : null}
        {assignMenu.isError && <p className="text-sm text-destructive">Не удалось назначить меню. Повторите попытку.</p>}
        {selected && restaurantMenu.data ? <LocalOverrides categories={restaurantMenu.data.categories} item={overrideItem} draft={overrideDraft} onEdit={(item) => { setOverrideItem(item); setOverrideDraft({ description: item.description, ingredients: item.ingredients, weightGrams: item.weightGrams, measurementUnit: item.measurementUnit, priceKopecks: item.priceKopecks }) }} onChange={setOverrideDraft} onCancel={() => setOverrideItem(null)} onSave={() => saveOverride.mutate()} onReset={() => resetOverride.mutate()} saving={saveOverride.isPending || resetOverride.isPending} /> : null}
        {restaurantMenu.isError ? <p className="text-sm text-muted-foreground">Назначьте набор меню, чтобы настроить позиции только для этой точки.</p> : null}
        {!selected ? <p className="text-sm text-muted-foreground">Сначала сохраните ресторан, затем назначьте ему набор меню.</p> : null}
        </> : null}
        {save.isError && <p className="text-sm text-destructive">{restaurantSaveErrorMessage(save.error)}</p>}
        <div className="admin-form-actions"><Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? 'Сохраняем…' : selected ? 'Сохранить изменения' : 'Создать ресторан'}</Button><Button asChild type="button" variant="outline"><Link to="/restaurants">Отмена</Link></Button></div>
      </form>
    </CardContent></Card>
    {selected ? <Card className="admin-danger-zone"><CardHeader><CardTitle>Удаление ресторана</CardTitle><CardDescription>Точка исчезнет с сайта вместе с локальным графиком и настройками меню. Сам набор меню сохранится.</CardDescription></CardHeader><CardContent><Button disabled={removeRestaurant.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить ресторан «${selected.name}»?`)) removeRestaurant.mutate() }}>{removeRestaurant.isPending ? 'Удаляем…' : 'Удалить ресторан'}</Button>{removeRestaurant.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить ресторан.</p> : null}</CardContent></Card> : null}
  </section>
}

function freshRestaurant(): UpsertRestaurantRequest {
  return { ...emptyRestaurant, openingHours: defaultHours.map((entry) => ({ ...entry })) }
}

export function normalizeRestaurantGalleryUrls(urls: string[]) {
  return urls.map((url) => url.trim()).filter(Boolean).slice(0, 12)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
export function restaurantToDraft(restaurant: AdminRestaurant): UpsertRestaurantRequest {
  const {
    id: _id,
    menuId: _menuId,
    menuName: _menuName,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...draft
  } = restaurant
  return {
    ...draft,
    phone: formatRussianPhone(restaurant.phone),
    format: restaurant.format === 'AIRPORT' ? 'AIRPORT' : 'CITY',
    area: restaurant.area === 'AIRPORT' ? 'AIRPORT' : 'CITY',
    isAtApartHotel: false,
  }
}
const formatLabel = { CITY: 'Город', PARK: 'Город', AIRPORT: 'Аэропорт', APART_HOTEL: 'Город' }
const dayLabel = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

const restaurantFieldLabels: Record<string, string> = {
  slug: 'Адрес страницы',
  name: 'Название ресторана',
  format: 'Тип ресторана',
  area: 'Тип ресторана',
  city: 'Город',
  address: 'Адрес',
  phone: 'Телефон',
  coffeePickupEnabled: 'Самовывоз кофе',
  description: 'Короткое описание',
  aboutTitle: 'Заголовок блока «О ресторане»',
  aboutText: 'Текст блока «О ресторане»',
  visitAmenities: 'Особенности блока «Перед визитом»',
  coverImageUrl: 'Фотография ресторана',
  galleryUrls: 'Фотографии галереи',
  menuPdfUrl: 'PDF меню',
  latitude: 'Широта',
  longitude: 'Долгота',
  yandexMapsUrl: 'Яндекс Карты',
  twoGisUrl: '2ГИС',
  openingHours: 'График работы',
}

export function restaurantSaveErrorMessage(error: unknown) {
  const field = validationFieldLabel(error)
  if (field) return `Не удалось сохранить: проверьте поле «${field}».`

  if (error instanceof ApiRequestError) {
    if (error.code === 'CONFLICT') return error.message
    if (error.code === 'VALIDATION_ERROR') return 'Сервер отклонил данные ресторана. Проверьте поля текущего раздела.'
    return `Не удалось сохранить ресторан: ${error.message}`
  }

  if (error instanceof TypeError) return 'Нет связи с API. Проверьте, что backend запущен, и повторите сохранение.'
  return 'Не удалось сохранить ресторан. Повторите попытку.'
}

function validationFieldLabel(error: unknown) {
  const issues = error instanceof ZodError
    ? error.issues
    : error instanceof ApiRequestError && Array.isArray(error.details)
      ? error.details
      : []
  const issue = issues.find((candidate): candidate is { path: unknown[] } => {
    if (!candidate || typeof candidate !== 'object' || !('path' in candidate)) return false
    return Array.isArray(candidate.path) && candidate.path.length > 0
  })
  const field = issue?.path[0]
  return typeof field === 'string' ? restaurantFieldLabels[field] : undefined
}

function LocalOverrides({ categories, item, draft, onEdit, onChange, onCancel, onSave, onReset, saving }: {
  categories: AdminRestaurantMenuDetailResponse['categories']; item: LocalMenuItem | null; draft: UpsertRestaurantMenuItemOverrideRequest
  onEdit: (item: LocalMenuItem) => void; onChange: (value: UpsertRestaurantMenuItemOverrideRequest) => void; onCancel: () => void; onSave: () => void; onReset: () => void; saving: boolean
}) {
  return <section className="grid gap-3 border-t pt-5"><div><strong>Локальные изменения меню</strong><p className="text-sm text-muted-foreground">Переопределяют базовое блюдо только в этом ресторане.</p></div>
    {item ? <div className="grid gap-3 rounded-xl border p-3"><b>{item.name}</b><Field label="Описание"><Textarea value={draft.description ?? ''} onChange={(event) => onChange({ ...draft, description: nullableDraftText(event.target.value) })} /></Field><Field label="Состав"><Textarea value={draft.ingredients ?? ''} onChange={(event) => onChange({ ...draft, ingredients: nullableDraftText(event.target.value) })} /></Field><div className="grid gap-3 sm:grid-cols-3"><Field label="Цена, ₽"><Input min={0} type="number" value={draft.priceKopecks === null ? '' : draft.priceKopecks / 100} onChange={(event) => onChange({ ...draft, priceKopecks: event.target.value === '' ? null : Math.round(Number(event.target.value) * 100) })} /></Field><Field label="Количество"><Input min={1} type="number" value={draft.weightGrams ?? ''} onChange={(event) => onChange({ ...draft, weightGrams: event.target.value === '' ? null : Number(event.target.value) })} /></Field><Field label="Единица"><select value={draft.measurementUnit ?? ''} onChange={(event) => onChange({ ...draft, measurementUnit: event.target.value ? event.target.value as NonNullable<UpsertRestaurantMenuItemOverrideRequest['measurementUnit']> : null })}><option value="">Как в базовом меню</option><option value="GRAM">г</option><option value="MILLILITER">мл</option><option value="PIECE">шт.</option></select></Field></div><div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={onSave} type="button">Сохранить для точки</Button>{item.overridden ? <Button disabled={saving} onClick={onReset} type="button" variant="outline">Вернуть базовое</Button> : null}<Button disabled={saving} onClick={onCancel} type="button" variant="ghost">Отмена</Button></div></div> : <div className="grid gap-3">{categories.map((category) => <div className="grid gap-1" key={category.id}><b className="text-sm">{category.name}</b>{category.items.map((menuItem) => <button className="flex items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-muted" key={menuItem.id} onClick={() => onEdit(menuItem)} type="button"><span className="text-sm">{menuItem.name}</span><small className={menuItem.overridden ? 'text-primary' : 'text-muted-foreground'}>{menuItem.overridden ? 'Изменено для точки' : `${menuItem.priceKopecks / 100} ₽`}</small></button>)}</div>)}</div>}</section>
}

export function ScheduleExceptions({ exceptions, draft, loading, saving, error, onChange, onSave, onDelete }: { exceptions: RestaurantScheduleException[]; draft: UpsertRestaurantScheduleExceptionRequest; loading: boolean; saving: boolean; error: boolean; onChange: (value: UpsertRestaurantScheduleExceptionRequest) => void; onSave: () => void; onDelete: (id: string) => void }) {
  return <section className="grid gap-3 border-t pt-5"><div><strong>Исключения в графике</strong><p className="text-sm text-muted-foreground">Разовые часы на праздники, санитарные дни и события.</p></div><div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2"><Field label="Дата"><Input aria-required="true" type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} /></Field><Field label="Подпись"><Input aria-required="true" placeholder="Новогодний график" value={draft.label} onChange={(event) => onChange({ ...draft, label: event.target.value })} /></Field><Field label="Открытие"><Input disabled={draft.isClosed} type="time" value={draft.opensAt ?? ''} onChange={(event) => onChange({ ...draft, opensAt: event.target.value || null })} /></Field><Field label="Закрытие"><Input disabled={draft.isClosed} type="time" value={draft.closesAt ?? ''} onChange={(event) => onChange({ ...draft, closesAt: event.target.value || null })} /></Field><label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input checked={draft.isClosed} type="checkbox" onChange={(event) => onChange({ ...draft, isClosed: event.target.checked })} />Кофейня не работает</label><Button disabled={saving || !draft.date || !draft.label.trim()} onClick={onSave} type="button" className="w-fit">Добавить исключение</Button></div>{loading ? <p className="text-sm text-muted-foreground">Загружаем исключения…</p> : null}{exceptions.map((exception) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2" key={exception.id}><div><b className="text-sm">{exception.label}</b><p className="text-xs text-muted-foreground">{exception.date} · {exception.isClosed ? 'не работает' : `${exception.opensAt}–${exception.closesAt}`}</p></div><Button disabled={saving} onClick={() => onDelete(exception.id)} size="sm" type="button" variant="ghost">Удалить</Button></div>)}{error ? <p className="text-sm text-destructive">Не удалось сохранить исключение графика.</p> : null}</section>
}
