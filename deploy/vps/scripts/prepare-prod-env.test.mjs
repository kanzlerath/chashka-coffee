import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createProdEnv, renderProdEnv } from './prepare-prod-env.mjs'

const devEnv = `APP_DIR=/srv/chashka-coffee/app
UPLOADS_DIR=/srv/chashka-coffee/uploads
WEBSITE_RELEASES_DIR=/srv/chashka-coffee/website-releases
POSTGRES_USER=chashka
POSTGRES_PASSWORD=dev-password
DATABASE_URL=postgresql://chashka:dev-password@postgres:5432/chashka_coffee_dev?schema=public
JWT_SECRET=dev-jwt
PREMIUMBONUS_API_TOKEN=private-premium-token
TELEGRAM_BOT_TOKEN=private-telegram-token
YOOKASSA_SECRET_KEY=private-test-key
YOOKASSA_TEST_MODE=true
PUBLIC_YANDEX_METRIKA_ID=111388685
`

test('production environment separates state and auth while preserving approved integrations', () => {
  const result = renderProdEnv(devEnv, {
    postgresPassword: 'prod-password',
    jwtSecret: 'prod-jwt',
  })

  expect(result).toContain('DATABASE_URL=postgresql://chashka:prod-password@postgres:5432/chashka_coffee_prod?schema=public')
  expect(result).toContain('JWT_SECRET=prod-jwt')
  expect(result).toContain('UPLOADS_DIR=/srv/chashka-coffee/prod/uploads')
  expect(result).toContain('WEBSITE_RELEASES_DIR=/srv/chashka-coffee/prod/website-releases')
  expect(result).toContain('BACKEND_ENV_FILE=.env.prod')
  expect(result).toContain('PUBLIC_API_URL=https://api.chashkacoffee.ru')
  expect(result).toContain('CORS_ORIGINS=https://chashkacoffee.ru,https://www.chashkacoffee.ru,https://admin.chashkacoffee.ru')
  expect(result).toContain('PREMIUMBONUS_API_TOKEN=private-premium-token')
  expect(result).toContain('TELEGRAM_BOT_TOKEN=private-telegram-token')
  expect(result).toContain('YOOKASSA_SECRET_KEY=private-test-key')
  expect(result).toContain('YOOKASSA_TEST_MODE=true')
  expect(result).toContain('PUBLIC_YANDEX_METRIKA_ID=111388685')
  expect(result).not.toContain('dev-password')
  expect(result).not.toContain('dev-jwt')
})

test('production environment refuses ambiguous input and never overwrites an existing file', async () => {
  expect(() => renderProdEnv(`${devEnv}JWT_SECRET=duplicate\n`, {
    postgresPassword: 'prod-password',
    jwtSecret: 'prod-jwt',
  })).toThrow('Duplicate DEV env key: JWT_SECRET')
  expect(() => renderProdEnv(`${devEnv}EXTRA_URL=https://api-dev.chashkacoffee.ru\n`, {
    postgresPassword: 'prod-password',
    jwtSecret: 'prod-jwt',
  })).toThrow('Production env still contains a DEV hostname in EXTRA_URL')

  const directory = await mkdtemp(join(tmpdir(), 'chashka-prod-env-'))
  const devPath = join(directory, '.env.dev')
  const prodPath = join(directory, '.env.prod')
  try {
    await writeFile(devPath, devEnv)
    await createProdEnv(devPath, prodPath)
    const first = await readFile(prodPath, 'utf8')
    expect(first).not.toContain('dev-password')
    await expect(createProdEnv(devPath, prodPath)).rejects.toThrow()
    expect(await readFile(prodPath, 'utf8')).toBe(first)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
