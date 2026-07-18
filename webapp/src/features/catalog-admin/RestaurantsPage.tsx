import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminRestaurant, AdminRestaurantMenuDetailResponse, RestaurantOpeningHoursEntry, RestaurantScheduleException, UpsertRestaurantMenuItemOverrideRequest, UpsertRestaurantRequest, UpsertRestaurantScheduleExceptionRequest } from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'

import { AdminPageHeader, AdminTabs } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
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
  slug: '', name: '', format: 'CITY', area: 'CITY', isAtApartHotel: false,
  city: 'Новосибирск', address: '', phone: '', description: null, coverImageUrl: null,
  latitude: null, longitude: null, yandexMapsUrl: null, twoGisUrl: null,
  openingHours: defaultHours,
}

type LocalMenuItem = AdminRestaurantMenuDetailResponse['categories'][number]['items'][number]
const emptyScheduleException = (): UpsertRestaurantScheduleExceptionRequest => ({ date: new Date().toISOString().slice(0, 10), label: '', opensAt: '08:00', closesAt: '22:00', isClosed: false })

export function RestaurantsPage() {
  const { api: authApi } = useAuth()
  const queryClient = useQueryClient()
  const api = useMemo(() => new CatalogAdminApi(authApi), [authApi])
  const [selected, setSelected] = useState<AdminRestaurant | null>(null)
  const [draft, setDraft] = useState<UpsertRestaurantRequest>(emptyRestaurant)
  const [overrideItem, setOverrideItem] = useState<LocalMenuItem | null>(null)
  const [overrideDraft, setOverrideDraft] = useState<UpsertRestaurantMenuItemOverrideRequest>({ description: null, ingredients: null, weightGrams: null, priceKopecks: null })
  const [scheduleDraft, setScheduleDraft] = useState<UpsertRestaurantScheduleExceptionRequest>(emptyScheduleException)
  const [editorTab, setEditorTab] = useState<'main' | 'map' | 'schedule' | 'menu'>('main')
  const restaurants = useQuery({ queryKey: ['admin', 'restaurants'], queryFn: () => api.listRestaurants() })
  const menus = useQuery({ queryKey: ['admin', 'menus'], queryFn: () => api.listMenus() })
  const restaurantMenu = useQuery({ queryKey: ['admin', 'restaurant-menu', selected?.id], enabled: Boolean(selected?.id && selected.menuId), queryFn: () => api.getRestaurantMenuDetail(selected!.id) })
  const scheduleExceptions = useQuery({ queryKey: ['admin', 'restaurant-schedule-exceptions', selected?.id], enabled: Boolean(selected?.id), queryFn: () => api.listRestaurantScheduleExceptions(selected!.id) })
  const save = useMutation({
    mutationFn: () => selected ? api.updateRestaurant(selected.id, draft) : api.createRestaurant(draft),
    onSuccess: (result) => {
      setSelected(result.restaurant)
      setDraft(toDraft(result.restaurant))
      void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
    },
  })
  const assignMenu = useMutation({
    mutationFn: (menuId: string | null) => api.assignRestaurantMenu(selected!.id, menuId),
    onSuccess: ({ menuId }) => {
      setSelected((current) => current ? { ...current, menuId, menuName: menus.data?.menus.find((menu) => menu.id === menuId)?.name ?? null } : current)
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

  function choose(restaurant: AdminRestaurant) { setSelected(restaurant); setDraft(toDraft(restaurant)); setOverrideItem(null); setScheduleDraft(emptyScheduleException()); setEditorTab('main') }
  function startNew() { setSelected(null); setDraft({ ...emptyRestaurant, openingHours: defaultHours.map((entry) => ({ ...entry })) }); setOverrideItem(null); setScheduleDraft(emptyScheduleException()); setEditorTab('main') }
  function change<K extends keyof UpsertRestaurantRequest>(key: K, value: UpsertRestaurantRequest[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  function changeHours(dayOfWeek: number, patch: Partial<RestaurantOpeningHoursEntry>) {
    change('openingHours', draft.openingHours.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry))
  }

  return <section className="admin-page">
    <AdminPageHeader eyebrow="Каталог" title="Рестораны" description="Точки сети, адреса, график работы и индивидуальное меню каждой локации." actions={<Button type="button" onClick={startNew}>Новый ресторан</Button>} />
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,.72fr)_minmax(0,1.28fr)]">
    <Card className="admin-resource-list min-h-[620px]"><CardHeader><CardTitle>Все рестораны</CardTitle><CardDescription>Выберите точку для редактирования.</CardDescription></CardHeader><CardContent className="grid gap-2">
      {restaurants.isPending && <CardDescription>Загружаем рестораны…</CardDescription>}
      {restaurants.data?.restaurants.map((restaurant) => <button key={restaurant.id} type="button" onClick={() => choose(restaurant)} className="admin-list-row grid" data-selected={selected?.id === restaurant.id || undefined}><span><strong>{restaurant.name}</strong><span className="mt-1 block text-sm text-muted-foreground">{restaurant.address} · {formatLabel[restaurant.format]}</span><small className="mt-1 text-muted-foreground">{restaurant.menuName ?? 'Меню не назначено'}</small></span></button>)}
      {restaurants.isError && <p className="text-sm text-destructive">Не удалось загрузить данные. Проверьте, что API запущен.</p>}
    </CardContent></Card>
    <Card className="admin-editor-card"><CardHeader><CardTitle>{selected ? 'Редактировать ресторан' : 'Новый ресторан'}</CardTitle><CardDescription>Базовые данные точки и назначение её меню.</CardDescription></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <AdminTabs label="Разделы ресторана" value={editorTab} onChange={setEditorTab} tabs={[{ value: 'main', label: 'Основное' }, { value: 'map', label: 'Карта' }, { value: 'schedule', label: 'График' }, { value: 'menu', label: 'Меню' }]} />
        {editorTab === 'main' ? <>
        <Field label="Название"><Input required value={draft.name} onChange={(event) => change('name', event.target.value)} /></Field>
        <Field label="Адрес страницы"><Input required value={draft.slug} placeholder="krasny-prospekt" onChange={(event) => change('slug', event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Формат"><select value={draft.format} onChange={(event) => change('format', event.target.value as UpsertRestaurantRequest['format'])}><option value="CITY">Городской ресторан</option><option value="AIRPORT">Ресторан в аэропорту</option></select></Field><Field label="Расположение"><select value={draft.area} onChange={(event) => change('area', event.target.value as UpsertRestaurantRequest['area'])}><option value="CITY">Город</option><option value="AIRPORT">Аэропорт</option></select></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Город"><Input required value={draft.city} onChange={(event) => change('city', event.target.value)} /></Field><Field label="Телефон"><Input required value={draft.phone} onChange={(event) => change('phone', event.target.value)} /></Field></div>
        <Field label="Адрес"><Input required value={draft.address} onChange={(event) => change('address', event.target.value)} /></Field>
        <Field label="Описание"><Textarea value={draft.description ?? ''} onChange={(event) => change('description', event.target.value.trim() || null)} /></Field>
        <Field label="Обложка"><Input type="url" placeholder="https://… ссылка на фотографию" value={draft.coverImageUrl ?? ''} onChange={(event) => change('coverImageUrl', event.target.value.trim() || null)} /></Field>
        </> : null}
        {editorTab === 'map' ? <>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Ссылка на Яндекс Карты"><Input type="url" value={draft.yandexMapsUrl ?? ''} onChange={(event) => change('yandexMapsUrl', event.target.value.trim() || null)} /></Field><Field label="Ссылка на 2ГИС"><Input type="url" value={draft.twoGisUrl ?? ''} onChange={(event) => change('twoGisUrl', event.target.value.trim() || null)} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Широта"><Input type="number" step="any" value={draft.latitude ?? ''} onChange={(event) => change('latitude', event.target.value === '' ? null : Number(event.target.value))} /></Field><Field label="Долгота"><Input type="number" step="any" value={draft.longitude ?? ''} onChange={(event) => change('longitude', event.target.value === '' ? null : Number(event.target.value))} /></Field></div>
        </> : null}
        {editorTab === 'schedule' ? <>
        <fieldset className="grid gap-2 rounded-xl border p-3"><legend className="px-1 text-sm font-medium">График работы</legend>{draft.openingHours.map((entry) => <div className="grid grid-cols-[74px_1fr_1fr_auto] items-center gap-2" key={entry.dayOfWeek}><span className="text-sm">{dayLabel[entry.dayOfWeek]}</span><Input aria-label={`Открытие, ${dayLabel[entry.dayOfWeek]}`} disabled={entry.isClosed} type="time" value={entry.opensAt ?? ''} onChange={(event) => changeHours(entry.dayOfWeek, { opensAt: event.target.value || null })} /><Input aria-label={`Закрытие, ${dayLabel[entry.dayOfWeek]}`} disabled={entry.isClosed} type="time" value={entry.closesAt ?? ''} onChange={(event) => changeHours(entry.dayOfWeek, { closesAt: event.target.value || null })} /><label className="flex items-center gap-1 text-xs"><input checked={entry.isClosed} type="checkbox" onChange={(event) => changeHours(entry.dayOfWeek, { isClosed: event.target.checked })} />выходной</label></div>)}</fieldset>
        {selected ? <ScheduleExceptions exceptions={scheduleExceptions.data?.exceptions ?? []} draft={scheduleDraft} loading={scheduleExceptions.isPending} saving={saveScheduleException.isPending || deleteScheduleException.isPending} error={scheduleExceptions.isError || saveScheduleException.isError || deleteScheduleException.isError} onChange={setScheduleDraft} onSave={() => saveScheduleException.mutate()} onDelete={(exceptionId) => deleteScheduleException.mutate(exceptionId)} /> : null}
        {!selected ? <p className="text-sm text-muted-foreground">Сначала сохраните ресторан, затем добавляйте отдельные исключения графика.</p> : null}
        </> : null}
        {editorTab === 'menu' ? <>
        {selected ? <Field label="Набор меню"><select disabled={assignMenu.isPending || menus.isPending} value={selected.menuId ?? ''} onChange={(event) => assignMenu.mutate(event.target.value || null)}><option value="">Меню не назначено</option>{menus.data?.menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select><small className="text-muted-foreground">Для точки используется один основной набор. Изменение применяется сразу.</small></Field> : null}
        {assignMenu.isError && <p className="text-sm text-destructive">Не удалось назначить меню. Повторите попытку.</p>}
        {selected && restaurantMenu.data ? <LocalOverrides categories={restaurantMenu.data.categories} item={overrideItem} draft={overrideDraft} onEdit={(item) => { setOverrideItem(item); setOverrideDraft({ description: item.description, ingredients: item.ingredients, weightGrams: item.weightGrams, priceKopecks: item.priceKopecks }) }} onChange={setOverrideDraft} onCancel={() => setOverrideItem(null)} onSave={() => saveOverride.mutate()} onReset={() => resetOverride.mutate()} saving={saveOverride.isPending || resetOverride.isPending} /> : null}
        {restaurantMenu.isError ? <p className="text-sm text-muted-foreground">Назначьте набор меню, чтобы настроить позиции только для этой точки.</p> : null}
        {!selected ? <p className="text-sm text-muted-foreground">Сначала сохраните ресторан, затем назначьте ему набор меню.</p> : null}
        </> : null}
        {save.isError && <p className="text-sm text-destructive">Не удалось сохранить. Проверьте обязательные поля и уникальность адреса страницы.</p>}
        <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? 'Сохраняем…' : selected ? 'Сохранить изменения' : 'Создать ресторан'}</Button>
      </form>
    </CardContent></Card>
    </div>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
function toDraft(restaurant: AdminRestaurant): UpsertRestaurantRequest {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = restaurant
  return {
    ...draft,
    format: restaurant.format === 'AIRPORT' ? 'AIRPORT' : 'CITY',
    area: restaurant.area === 'AIRPORT' ? 'AIRPORT' : 'CITY',
    isAtApartHotel: false,
  }
}
const formatLabel = { CITY: 'Город', PARK: 'Город', AIRPORT: 'Аэропорт', APART_HOTEL: 'Город' }
const dayLabel = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function LocalOverrides({ categories, item, draft, onEdit, onChange, onCancel, onSave, onReset, saving }: {
  categories: AdminRestaurantMenuDetailResponse['categories']; item: LocalMenuItem | null; draft: UpsertRestaurantMenuItemOverrideRequest
  onEdit: (item: LocalMenuItem) => void; onChange: (value: UpsertRestaurantMenuItemOverrideRequest) => void; onCancel: () => void; onSave: () => void; onReset: () => void; saving: boolean
}) {
  return <section className="grid gap-3 border-t pt-5"><div><strong>Локальные изменения меню</strong><p className="text-sm text-muted-foreground">Переопределяют базовое блюдо только в этом ресторане.</p></div>
    {item ? <div className="grid gap-3 rounded-xl border p-3"><b>{item.name}</b><Field label="Описание"><Textarea value={draft.description ?? ''} onChange={(event) => onChange({ ...draft, description: event.target.value.trim() || null })} /></Field><Field label="Состав"><Textarea value={draft.ingredients ?? ''} onChange={(event) => onChange({ ...draft, ingredients: event.target.value.trim() || null })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Цена, ₽"><Input min={0} type="number" value={draft.priceKopecks === null ? '' : draft.priceKopecks / 100} onChange={(event) => onChange({ ...draft, priceKopecks: event.target.value === '' ? null : Math.round(Number(event.target.value) * 100) })} /></Field><Field label="Вес, г"><Input min={0} type="number" value={draft.weightGrams ?? ''} onChange={(event) => onChange({ ...draft, weightGrams: event.target.value === '' ? null : Number(event.target.value) })} /></Field></div><div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={onSave} type="button">Сохранить для точки</Button>{item.overridden ? <Button disabled={saving} onClick={onReset} type="button" variant="outline">Вернуть базовое</Button> : null}<Button disabled={saving} onClick={onCancel} type="button" variant="ghost">Отмена</Button></div></div> : <div className="grid gap-3">{categories.map((category) => <div className="grid gap-1" key={category.id}><b className="text-sm">{category.name}</b>{category.items.map((menuItem) => <button className="flex items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-muted" key={menuItem.id} onClick={() => onEdit(menuItem)} type="button"><span className="text-sm">{menuItem.name}</span><small className={menuItem.overridden ? 'text-primary' : 'text-muted-foreground'}>{menuItem.overridden ? 'Изменено для точки' : `${menuItem.priceKopecks / 100} ₽`}</small></button>)}</div>)}</div>}</section>
}

function ScheduleExceptions({ exceptions, draft, loading, saving, error, onChange, onSave, onDelete }: { exceptions: RestaurantScheduleException[]; draft: UpsertRestaurantScheduleExceptionRequest; loading: boolean; saving: boolean; error: boolean; onChange: (value: UpsertRestaurantScheduleExceptionRequest) => void; onSave: () => void; onDelete: (id: string) => void }) {
  return <section className="grid gap-3 border-t pt-5"><div><strong>Исключения в графике</strong><p className="text-sm text-muted-foreground">Разовые часы на праздники, санитарные дни и события.</p></div><div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2"><Field label="Дата"><Input required type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} /></Field><Field label="Подпись"><Input required placeholder="Новогодний график" value={draft.label} onChange={(event) => onChange({ ...draft, label: event.target.value })} /></Field><Field label="Открытие"><Input disabled={draft.isClosed} type="time" value={draft.opensAt ?? ''} onChange={(event) => onChange({ ...draft, opensAt: event.target.value || null })} /></Field><Field label="Закрытие"><Input disabled={draft.isClosed} type="time" value={draft.closesAt ?? ''} onChange={(event) => onChange({ ...draft, closesAt: event.target.value || null })} /></Field><label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input checked={draft.isClosed} type="checkbox" onChange={(event) => onChange({ ...draft, isClosed: event.target.checked })} />Кофейня не работает</label><Button disabled={saving || !draft.date || !draft.label.trim()} onClick={onSave} type="button" className="w-fit">Добавить исключение</Button></div>{loading ? <p className="text-sm text-muted-foreground">Загружаем исключения…</p> : null}{exceptions.map((exception) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2" key={exception.id}><div><b className="text-sm">{exception.label}</b><p className="text-xs text-muted-foreground">{exception.date} · {exception.isClosed ? 'не работает' : `${exception.opensAt}–${exception.closesAt}`}</p></div><Button disabled={saving} onClick={() => onDelete(exception.id)} size="sm" type="button" variant="ghost">Удалить</Button></div>)}{error ? <p className="text-sm text-destructive">Не удалось сохранить исключение графика.</p> : null}</section>
}
