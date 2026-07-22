export type OpeningHoursEntry = {
  dayOfWeek: number
  opensAt: string | null
  closesAt: string | null
  isClosed: boolean
}

const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const
const mondayFirst = [1, 2, 3, 4, 5, 6, 0] as const

function scheduleLabel(entry: OpeningHoursEntry) {
  if (entry.isClosed) return 'выходной'
  if (!entry.opensAt || !entry.closesAt) return null
  return `${entry.opensAt}–${entry.closesAt}`
}

export function formatOpeningHours(entries: OpeningHoursEntry[]) {
  const byDay = new Map(entries.map((entry) => [entry.dayOfWeek, entry]))
  const ordered = mondayFirst.map((dayOfWeek) => byDay.get(dayOfWeek))
  if (ordered.some((entry) => !entry)) return 'Уточняйте часы работы'

  const schedule = ordered.map((entry) => scheduleLabel(entry!))
  if (schedule.some((label) => !label)) return 'Уточняйте часы работы'
  if (schedule.every((label) => label === schedule[0])) return `Ежедневно: ${schedule[0]}`

  const groups: Array<{ start: number; end: number; label: string }> = []
  schedule.forEach((label, index) => {
    const previous = groups.at(-1)
    if (previous?.label === label) previous.end = index
    else groups.push({ start: index, end: index, label: label! })
  })

  return groups.map(({ start, end, label }) => {
    const firstDay = dayLabels[mondayFirst[start]!]
    const lastDay = dayLabels[mondayFirst[end]!]
    const days = start === end ? firstDay : `${firstDay}–${lastDay}`
    return `${days}: ${label}`
  }).join(' · ')
}
