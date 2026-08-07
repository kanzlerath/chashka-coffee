import { mkdir, readdir, rename, rm, symlink } from 'node:fs/promises'
import { basename, join } from 'node:path'

const retainedReleaseCount = 3

export async function publishWebsiteRelease({ releasesDir, build, releaseName = createReleaseName() }) {
  const finalDir = join(releasesDir, releaseName)
  const temporaryDir = join(releasesDir, `.${releaseName}.building`)
  const temporaryLink = join(releasesDir, `.current-${process.pid}-${Date.now()}`)
  await mkdir(releasesDir, { recursive: true })
  await rm(temporaryDir, { recursive: true, force: true })
  await mkdir(temporaryDir)

  try {
    await build(temporaryDir)
    await rename(temporaryDir, finalDir)
    await symlink(releaseName, temporaryLink)
    await rename(temporaryLink, join(releasesDir, 'current'))
    await pruneOldReleases(releasesDir, releaseName)
    return finalDir
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true })
    await rm(temporaryLink, { force: true })
    throw error
  }
}

function createReleaseName() {
  return `release-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`
}

async function pruneOldReleases(releasesDir, currentReleaseName) {
  const entries = await readdir(releasesDir, { withFileTypes: true })
  const releases = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('release-'))
    .map((entry) => entry.name)
    .sort()
    .reverse()

  const kept = new Set([currentReleaseName, ...releases.slice(0, retainedReleaseCount)])
  await Promise.all(
    releases
      .filter((release) => !kept.has(release))
      .map((release) => rm(join(releasesDir, basename(release)), { recursive: true, force: true })),
  )
}
