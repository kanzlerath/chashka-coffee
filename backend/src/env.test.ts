import { describe, expect, test } from 'bun:test'

import { loadEnv } from './env'

describe('loadEnv', () => {
  test('parses defaults and comma-separated origins', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
      JWT_SECRET: '12345678901234567890123456789012',
      CORS_ORIGINS: 'http://localhost:5173, http://localhost:8081',
    })

    expect(env.PORT).toBe(3000)
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900)
    expect(env.COOKIE_SECURE).toBe(false)
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:8081'])
    expect(env.SPACES_REGION).toBeUndefined()
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined()
    expect(env.MEDIA_UPLOADS_DIR).toBeUndefined()
    expect(env.MEDIA_UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(env.MEDIA_VIDEO_UPLOAD_MAX_BYTES).toBe(100 * 1024 * 1024)
    expect(env.MEDIA_DOCUMENT_UPLOAD_MAX_BYTES).toBe(20 * 1024 * 1024)
    expect(env.SPACES_UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(env.SPACES_UPLOAD_URL_TTL_SECONDS).toBe(900)
    expect(env.SPACES_DOWNLOAD_URL_TTL_SECONDS).toBe(300)
    expect(env.SPACES_PUBLIC_CACHE_CONTROL).toBe('public, max-age=31536000, immutable')
  })

  test('trims optional Telegram configuration', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
      JWT_SECRET: '12345678901234567890123456789012',
      TELEGRAM_BOT_TOKEN: ' 123:secret ',
      TELEGRAM_BOT_USERNAME: ' chashka_notifications_bot ',
    })

    expect(env.TELEGRAM_BOT_TOKEN).toBe('123:secret')
    expect(env.TELEGRAM_BOT_USERNAME).toBe('chashka_notifications_bot')
  })

  test('requires complete YooKassa configuration and parses test mode', () => {
    const base = {
      DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
      JWT_SECRET: '12345678901234567890123456789012',
    }
    expect(() => loadEnv({ ...base, YOOKASSA_SHOP_ID: '123456' })).toThrow('YOOKASSA_SECRET_KEY')

    const env = loadEnv({
      ...base,
      YOOKASSA_SHOP_ID: ' 123456 ',
      YOOKASSA_SECRET_KEY: ' test_secret ',
      YOOKASSA_RETURN_URL: 'https://dev.example.com/order',
      YOOKASSA_TEST_MODE: 'true',
    })
    expect(env.YOOKASSA_SHOP_ID).toBe('123456')
    expect(env.YOOKASSA_SECRET_KEY).toBe('test_secret')
    expect(env.YOOKASSA_TEST_MODE).toBe(true)
  })

  test('parses the local media directory and upload limit', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
      JWT_SECRET: '12345678901234567890123456789012',
      MEDIA_UPLOADS_DIR: ' /srv/uploads ',
      MEDIA_UPLOAD_MAX_BYTES: '5242880',
      MEDIA_VIDEO_UPLOAD_MAX_BYTES: '52428800',
      MEDIA_DOCUMENT_UPLOAD_MAX_BYTES: '10485760',
    })

    expect(env.MEDIA_UPLOADS_DIR).toBe('/srv/uploads')
    expect(env.MEDIA_UPLOAD_MAX_BYTES).toBe(5 * 1024 * 1024)
    expect(env.MEDIA_VIDEO_UPLOAD_MAX_BYTES).toBe(50 * 1024 * 1024)
    expect(env.MEDIA_DOCUMENT_UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024)
  })

  test('requires complete DigitalOcean Spaces configuration when storage is enabled', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
        JWT_SECRET: '12345678901234567890123456789012',
        SPACES_BUCKET: 'uploads',
      }),
    ).toThrow()
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
        JWT_SECRET: '12345678901234567890123456789012',
        SPACES_CDN_BASE_URL: 'https://images.example.com',
      }),
    ).toThrow()

    const env = loadEnv({
      DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
      JWT_SECRET: '12345678901234567890123456789012',
      SPACES_REGION: 'nyc3',
      SPACES_BUCKET: 'uploads',
      SPACES_ENDPOINT: 'https://nyc3.digitaloceanspaces.com',
      SPACES_CDN_BASE_URL: 'https://images.example.com',
      SPACES_ACCESS_KEY_ID: 'access-key',
      SPACES_SECRET_ACCESS_KEY: 'secret-key',
    })

    expect(env.SPACES_REGION).toBe('nyc3')
    expect(env.SPACES_BUCKET).toBe('uploads')
    expect(env.SPACES_CDN_BASE_URL).toBe('https://images.example.com')
  })

  test('rejects known weak JWT secrets in production-like runtimes', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
        JWT_SECRET: 'replace-with-at-least-32-random-characters',
      }),
    ).toThrow('JWT_SECRET')

    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
        JWT_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        COOKIE_SECURE: 'true',
        CORS_ORIGINS: 'https://web.example.com',
      }),
    ).toThrow('JWT_SECRET')
  })

  test('rejects unsafe production CORS origins', () => {
    const baseEnv = {
      DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/chashka_coffee',
      JWT_SECRET: '12345678901234567890123456789012',
    }

    expect(() =>
      loadEnv({
        ...baseEnv,
        CORS_ORIGINS: '',
      }),
    ).toThrow('CORS_ORIGINS')

    expect(() =>
      loadEnv({
        ...baseEnv,
        CORS_ORIGINS: '*',
      }),
    ).toThrow('CORS_ORIGINS')

    expect(() =>
      loadEnv({
        ...baseEnv,
        CORS_ORIGINS: 'https://web.example.com/path',
      }),
    ).toThrow('CORS_ORIGINS')

    expect(() =>
      loadEnv({
        ...baseEnv,
        COOKIE_SECURE: 'true',
        CORS_ORIGINS: 'http://web.example.com',
      }),
    ).toThrow('CORS_ORIGINS')
  })
})
