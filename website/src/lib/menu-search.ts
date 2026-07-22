const normalizeMenuSearch = (value: string) =>
  value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ')

export const matchesMenuSearch = (query: string, values: string[]) => {
  const normalizedQuery = normalizeMenuSearch(query)
  if (!normalizedQuery) return true

  return normalizeMenuSearch(values.join(' ')).includes(normalizedQuery)
}
