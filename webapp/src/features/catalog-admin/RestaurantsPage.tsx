import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminRestaurant, RestaurantOpeningHoursEntry, UpsertRestaurantRequest } from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'

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

export function RestaurantsPage() {
  const { api: authApi } = useAuth()
  const queryClient = useQueryClient()
  const api = useMemo(() => new CatalogAdminApi(authApi), [authApi])
  const [selected, setSelected] = useState<AdminRestaurant | null>(null)
  const [draft, setDraft] = useState<UpsertRestaurantRequest>(emptyRestaurant)
  const restaurants = useQuery({ queryKey: ['admin', 'restaurants'], queryFn: () => api.listRestaurants() })
  const menus = useQuery({ queryKey: ['admin', 'menus'], queryFn: () => api.listMenus() })
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
      void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
    },
  })

  function choose(restaurant: AdminRestaurant) { setSelected(restaurant); setDraft(toDraft(restaurant)) }
  function startNew() { setSelected(null); setDraft({ ...emptyRestaurant, openingHours: defaultHours.map((entry) => ({ ...entry })) }) }
  function change<K extends keyof UpsertRestaurantRequest>(key: K, value: UpsertRestaurantRequest[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  function changeHours(dayOfWeek: number, patch: Partial<RestaurantOpeningHoursEntry>) {
    change('openingHours', draft.openingHours.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry))
  }

  return <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-9 lg:grid-cols-[.9fr_1.1fr]">
    <Card className="min-h-[620px]"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Кофейни</CardTitle><CardDescription>Точки сети, адреса и связь с меню.</CardDescription></div><Button type="button" size="sm" onClick={startNew}>Новая</Button></div></CardHeader><CardContent className="grid gap-2">
      {restaurants.isPending && <CardDescription>Загружаем точки…</CardDescription>}
      {restaurants.data?.restaurants.map((restaurant) => <button key={restaurant.id} type="button" onClick={() => choose(restaurant)} className="grid rounded-xl border p-4 text-left hover:bg-muted"><strong>{restaurant.name}</strong><span className="mt-1 text-sm text-muted-foreground">{restaurant.address} · {formatLabel[restaurant.format]}</span><small className="mt-1 text-muted-foreground">{restaurant.menuName ?? 'Меню не назначено'}</small></button>)}
      {restaurants.isError && <p className="text-sm text-destructive">Не удалось загрузить данные. Проверьте, что API запущен.</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{selected ? 'Редактировать кофейню' : 'Новая кофейня'}</CardTitle><CardDescription>Базовые данные точки и назначение её меню.</CardDescription></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <Field label="Название"><Input required value={draft.name} onChange={(event) => change('name', event.target.value)} /></Field>
        <Field label="Адрес страницы"><Input required value={draft.slug} placeholder="krasny-prospekt" onChange={(event) => change('slug', event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Формат"><select value={draft.format} onChange={(event) => change('format', event.target.value as UpsertRestaurantRequest['format'])}><option value="CITY">Городская</option><option value="PARK">Парк</option><option value="AIRPORT">Аэропорт</option><option value="APART_HOTEL">Апарт-отель</option></select></Field><Field label="Район"><select value={draft.area} onChange={(event) => change('area', event.target.value as UpsertRestaurantRequest['area'])}><option value="CITY">Город</option><option value="PARK">Парк</option><option value="AIRPORT">Аэропорт</option></select></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Город"><Input required value={draft.city} onChange={(event) => change('city', event.target.value)} /></Field><Field label="Телефон"><Input required value={draft.phone} onChange={(event) => change('phone', event.target.value)} /></Field></div>
        <Field label="Адрес"><Input required value={draft.address} onChange={(event) => change('address', event.target.value)} /></Field>
        <Field label="Описание"><Textarea value={draft.description ?? ''} onChange={(event) => change('description', event.target.value.trim() || null)} /></Field>
        <Field label="Обложка"><Input type="url" placeholder="https://… ссылка на фотографию" value={draft.coverImageUrl ?? ''} onChange={(event) => change('coverImageUrl', event.target.value.trim() || null)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Ссылка на Яндекс Карты"><Input type="url" value={draft.yandexMapsUrl ?? ''} onChange={(event) => change('yandexMapsUrl', event.target.value.trim() || null)} /></Field><Field label="Ссылка на 2ГИС"><Input type="url" value={draft.twoGisUrl ?? ''} onChange={(event) => change('twoGisUrl', event.target.value.trim() || null)} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Широта"><Input type="number" step="any" value={draft.latitude ?? ''} onChange={(event) => change('latitude', event.target.value === '' ? null : Number(event.target.value))} /></Field><Field label="Долгота"><Input type="number" step="any" value={draft.longitude ?? ''} onChange={(event) => change('longitude', event.target.value === '' ? null : Number(event.target.value))} /></Field></div>
        <fieldset className="grid gap-2 rounded-xl border p-3"><legend className="px-1 text-sm font-medium">График работы</legend>{draft.openingHours.map((entry) => <div className="grid grid-cols-[74px_1fr_1fr_auto] items-center gap-2" key={entry.dayOfWeek}><span className="text-sm">{dayLabel[entry.dayOfWeek]}</span><Input aria-label={`Открытие, ${dayLabel[entry.dayOfWeek]}`} disabled={entry.isClosed} type="time" value={entry.opensAt ?? ''} onChange={(event) => changeHours(entry.dayOfWeek, { opensAt: event.target.value || null })} /><Input aria-label={`Закрытие, ${dayLabel[entry.dayOfWeek]}`} disabled={entry.isClosed} type="time" value={entry.closesAt ?? ''} onChange={(event) => changeHours(entry.dayOfWeek, { closesAt: event.target.value || null })} /><label className="flex items-center gap-1 text-xs"><input checked={entry.isClosed} type="checkbox" onChange={(event) => changeHours(entry.dayOfWeek, { isClosed: event.target.checked })} />выходной</label></div>)}</fieldset>
        {selected ? <Field label="Набор меню"><select disabled={assignMenu.isPending || menus.isPending} value={selected.menuId ?? ''} onChange={(event) => assignMenu.mutate(event.target.value || null)}><option value="">Меню не назначено</option>{menus.data?.menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select><small className="text-muted-foreground">Для точки используется один основной набор. Изменение применяется сразу.</small></Field> : null}
        {assignMenu.isError && <p className="text-sm text-destructive">Не удалось назначить меню. Повторите попытку.</p>}
        {save.isError && <p className="text-sm text-destructive">Не удалось сохранить. Проверьте обязательные поля и уникальность адреса страницы.</p>}
        <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? 'Сохраняем…' : selected ? 'Сохранить изменения' : 'Создать кофейню'}</Button>
      </form>
    </CardContent></Card>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
function toDraft(restaurant: AdminRestaurant): UpsertRestaurantRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = restaurant; return draft }
const formatLabel = { CITY: 'Городская', PARK: 'Парк', AIRPORT: 'Аэропорт', APART_HOTEL: 'Апарт-отель' }
const dayLabel = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
