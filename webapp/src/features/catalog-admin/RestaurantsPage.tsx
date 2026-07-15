import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminRestaurant, UpsertRestaurantRequest } from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { CatalogAdminApi } from './api'

const emptyRestaurant: UpsertRestaurantRequest = {
  slug: '', name: '', format: 'CITY', area: 'CITY', isAtApartHotel: false,
  city: 'Новосибирск', address: '', phone: '', description: null, coverImageUrl: null,
  latitude: null, longitude: null, yandexMapsUrl: null, twoGisUrl: null,
}

export function RestaurantsPage() {
  const { api: authApi } = useAuth()
  const queryClient = useQueryClient()
  const api = useMemo(() => new CatalogAdminApi(authApi), [authApi])
  const [selected, setSelected] = useState<AdminRestaurant | null>(null)
  const [draft, setDraft] = useState<UpsertRestaurantRequest>(emptyRestaurant)
  const restaurants = useQuery({ queryKey: ['admin', 'restaurants'], queryFn: () => api.listRestaurants() })
  const save = useMutation({
    mutationFn: () => selected ? api.updateRestaurant(selected.id, draft) : api.createRestaurant(draft),
    onSuccess: (result) => {
      setSelected(result.restaurant)
      setDraft(toDraft(result.restaurant))
      void queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
    },
  })

  function choose(restaurant: AdminRestaurant) { setSelected(restaurant); setDraft(toDraft(restaurant)) }
  function startNew() { setSelected(null); setDraft(emptyRestaurant) }
  function change<K extends keyof UpsertRestaurantRequest>(key: K, value: UpsertRestaurantRequest[K]) { setDraft((current) => ({ ...current, [key]: value })) }

  return <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-9 lg:grid-cols-[.9fr_1.1fr]">
    <Card className="min-h-[620px]"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Кофейни</CardTitle><CardDescription>Точки сети, адреса и связь с меню.</CardDescription></div><Button type="button" size="sm" onClick={startNew}>Новая</Button></div></CardHeader><CardContent className="grid gap-2">
      {restaurants.isPending && <CardDescription>Загружаем точки…</CardDescription>}
      {restaurants.data?.restaurants.map((restaurant) => <button key={restaurant.id} type="button" onClick={() => choose(restaurant)} className="grid rounded-xl border p-4 text-left hover:bg-muted"><strong>{restaurant.name}</strong><span className="mt-1 text-sm text-muted-foreground">{restaurant.address} · {formatLabel[restaurant.format]}</span></button>)}
      {restaurants.isError && <p className="text-sm text-destructive">Не удалось загрузить данные. Проверьте, что API запущен.</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{selected ? 'Редактировать кофейню' : 'Новая кофейня'}</CardTitle><CardDescription>Заполни базовые данные точки. График, карты и фотографии добавим следующим шагом.</CardDescription></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <Field label="Название"><Input required value={draft.name} onChange={(event) => change('name', event.target.value)} /></Field>
        <Field label="Адрес страницы"><Input required value={draft.slug} placeholder="krasny-prospekt" onChange={(event) => change('slug', event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Формат"><select value={draft.format} onChange={(event) => change('format', event.target.value as UpsertRestaurantRequest['format'])}><option value="CITY">Городская</option><option value="PARK">Парк</option><option value="AIRPORT">Аэропорт</option><option value="APART_HOTEL">Апарт-отель</option></select></Field><Field label="Район"><select value={draft.area} onChange={(event) => change('area', event.target.value as UpsertRestaurantRequest['area'])}><option value="CITY">Город</option><option value="PARK">Парк</option><option value="AIRPORT">Аэропорт</option></select></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Город"><Input required value={draft.city} onChange={(event) => change('city', event.target.value)} /></Field><Field label="Телефон"><Input required value={draft.phone} onChange={(event) => change('phone', event.target.value)} /></Field></div>
        <Field label="Адрес"><Input required value={draft.address} onChange={(event) => change('address', event.target.value)} /></Field>
        <Field label="Описание"><Textarea value={draft.description ?? ''} onChange={(event) => change('description', event.target.value.trim() || null)} /></Field>
        {save.isError && <p className="text-sm text-destructive">Не удалось сохранить. Проверьте обязательные поля и уникальность адреса страницы.</p>}
        <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? 'Сохраняем…' : selected ? 'Сохранить изменения' : 'Создать кофейню'}</Button>
      </form>
    </CardContent></Card>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
function toDraft(restaurant: AdminRestaurant): UpsertRestaurantRequest { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = restaurant; return draft }
const formatLabel = { CITY: 'Городская', PARK: 'Парк', AIRPORT: 'Аэропорт', APART_HOTEL: 'Апарт-отель' }
