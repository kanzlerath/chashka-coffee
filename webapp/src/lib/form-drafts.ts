/** Keep the editor value intact while typing; API schemas normalize it on save. */
export function nullableDraftText(value: string): string | null {
  return value === '' ? null : value
}
