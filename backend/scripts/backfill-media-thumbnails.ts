import 'dotenv/config'

import { createPrisma } from '../src/db'
import { loadEnv } from '../src/env'
import { isImageContentType, localMediaConfigFromEnv, LocalMediaStorage } from '../src/storage/local-media'

const env = loadEnv(process.env)
const storageConfig = localMediaConfigFromEnv(env)
if (!storageConfig) throw new Error('MEDIA_UPLOADS_DIR is required.')

const db = createPrisma(env.DATABASE_URL)
const storage = new LocalMediaStorage(storageConfig)
let created = 0
let skipped = 0
let failed = 0

try {
  const assets = await db.mediaAsset.findMany({
    where: { status: 'READY' },
    orderBy: { createdAt: 'asc' },
    select: { objectKey: true, contentType: true },
  })

  for (const media of assets) {
    if (!isImageContentType(media.contentType)) continue
    if (await storage.thumbnailExists(media.objectKey)) {
      skipped += 1
      continue
    }

    try {
      await storage.createThumbnail(media.objectKey)
      created += 1
    } catch (error) {
      failed += 1
      console.error(`Unable to create media thumbnail for ${media.objectKey}`, error)
    }
  }

  console.log(`Media thumbnail backfill complete: ${created} created, ${skipped} already present, ${failed} failed.`)
  if (failed) process.exitCode = 1
} finally {
  await db.$disconnect()
}
