import type { MenuItemMeasurementUnit } from '@chashka-coffee/contracts'

const unitLabels: Record<MenuItemMeasurementUnit, string> = {
  GRAM: 'г',
  MILLILITER: 'мл',
  PIECE: 'шт.',
}

export function formatMenuPortion(size: number | null, unit: MenuItemMeasurementUnit) {
  return size ? `${size} ${unitLabels[unit]}` : '1 порция'
}
