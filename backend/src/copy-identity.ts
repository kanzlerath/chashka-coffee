const COPY_NAME_ENDING = / — копия(?: \d+)?$/
const COPY_SLUG_ENDING = /-copy(?:-\d+)?$/

type CopyIdentityInput = {
  name: string
  slug: string
  occupiedNames: Iterable<string>
  occupiedSlugs: Iterable<string>
}

export function nextCopyIdentity({ name, slug, occupiedNames, occupiedSlugs }: CopyIdentityInput) {
  const nameBase = name.replace(COPY_NAME_ENDING, '')
  const slugBase = slug.replace(COPY_SLUG_ENDING, '')
  const names = new Set(occupiedNames)
  const slugs = new Set(occupiedSlugs)

  for (let copyNumber = 1; copyNumber < 10_000; copyNumber += 1) {
    const nameEnding = copyNumber === 1 ? ' — копия' : ` — копия ${copyNumber}`
    const slugEnding = copyNumber === 1 ? '-copy' : `-copy-${copyNumber}`
    const candidate = {
      name: `${nameBase.slice(0, 180 - nameEnding.length).trimEnd()}${nameEnding}`,
      slug: `${slugBase.slice(0, 120 - slugEnding.length).replace(/-+$/, '')}${slugEnding}`,
    }

    if (!names.has(candidate.name) && !slugs.has(candidate.slug)) return candidate
  }

  throw new Error('Could not allocate a copy name and slug')
}
