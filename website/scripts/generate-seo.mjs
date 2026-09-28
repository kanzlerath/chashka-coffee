import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export async function generateSeoFiles({ outDir, siteUrl, disallowIndexing = false }) {
  const site = new URL(siteUrl)
  if (!['http:', 'https:'].includes(site.protocol) || site.pathname !== '/' || site.search || site.hash) {
    throw new Error('PUBLIC_SITE_URL must be a site origin without a path')
  }

  const urls = new Set()
  for (const file of await htmlFiles(outDir)) {
    const html = await readFile(file, 'utf8')
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue
    const canonical = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i.exec(html)?.[1]
    if (!canonical) continue
    const url = new URL(canonical)
    if (url.origin === site.origin) urls.add(url.href)
  }

  if (urls.size === 0) throw new Error('No indexable canonical pages found for sitemap')
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].sort().map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`
  const robots = disallowIndexing
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`

  await writeFile(join(outDir, 'sitemap.xml'), sitemap)
  await writeFile(join(outDir, 'robots.txt'), robots)
  return urls.size
}

async function htmlFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await htmlFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path)
  }
  return files
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character])
}

if (import.meta.main) {
  const outDir = resolve(process.env.WEBSITE_BUILD_OUT_DIR ?? 'dist')
  const siteUrl = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321'
  const count = await generateSeoFiles({
    outDir,
    siteUrl,
    disallowIndexing: process.env.PUBLIC_ROBOTS_DISALLOW === 'true',
  })
  console.log(`Generated robots.txt and sitemap.xml for ${count} pages`)
}
