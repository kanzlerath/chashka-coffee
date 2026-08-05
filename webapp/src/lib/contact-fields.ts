const RUSSIAN_PHONE_DIGITS = 11

export function formatRussianPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''

  const localNumber = (digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits).slice(0, RUSSIAN_PHONE_DIGITS - 1)
  if (!localNumber) return '+7'
  if (localNumber.length <= 3) return `+7 (${localNumber}`
  if (localNumber.length <= 6) return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3)}`
  if (localNumber.length <= 8) return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6)}`
  return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6, 8)}-${localNumber.slice(8)}`
}
