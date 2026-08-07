import type { DbClient } from '../db'

const stateId = 'global'

const publicWebsiteResources = new Set([
  'categories',
  'content',
  'homepage',
  'items',
  'jobs',
  'menus',
  'pages',
  'products',
  'restaurants',
  'site-settings',
  'workspace',
])

export function shouldRequestPublicWebsiteBuild(resource: string) {
  return publicWebsiteResources.has(resource)
}

export function needsPublishedResponse(resource: string) {
  return resource === 'content' || resource === 'jobs' || resource === 'products'
}

export function responsePublishesPublicContent(payload: unknown) {
  if (!payload || typeof payload !== 'object') return false
  const record = ['entry', 'opening', 'product']
    .map((key) => Reflect.get(payload, key))
    .find((value) => value && typeof value === 'object')
  return Boolean(record && Reflect.get(record, 'status') === 'PUBLISHED')
}

export async function requestPublicWebsiteBuild(db: DbClient, now = new Date()) {
  return db.websiteBuildState.upsert({
    where: { id: stateId },
    create: {
      id: stateId,
      requestedVersion: 1,
      status: 'QUEUED',
      requestedAt: now,
    },
    update: {
      requestedVersion: { increment: 1 },
      status: 'QUEUED',
      requestedAt: now,
      lastError: null,
    },
  })
}

export { stateId as websiteBuildStateId }
