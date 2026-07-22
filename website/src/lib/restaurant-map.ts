export type RestaurantMapPoint = {
  latitude: number
  longitude: number
}

export type MapBounds = [[number, number], [number, number]]

export function getMapBounds(points: RestaurantMapPoint[]): MapBounds | null {
  if (!points.length) return null

  const latitudes = points.map(({ latitude }) => latitude)
  const longitudes = points.map(({ longitude }) => longitude)
  return [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ]
}

export function getMapCenter(points: RestaurantMapPoint[]): [number, number] {
  const bounds = getMapBounds(points)
  if (!bounds) return [55.0302, 82.9204]

  return [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ]
}
