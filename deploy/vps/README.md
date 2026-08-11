# VPS dev deployment

This directory is the self-managed VPS path for the current static website,
static admin app, Bun API, and PostgreSQL. It is deliberately separate from
the repository-root `docker-compose.yml`, which is local-development-only.

## Services

- `postgres` is reachable only on the internal Compose network.
- `api` is reachable only through Caddy at `API_HOST`.
- `caddy` publishes ports 80 and 443, owns TLS certificates, and serves the
  built website and admin app.
- `website-build` and `webapp-build` are one-shot Bun containers. The website
  build writes a versioned release; the admin build writes static output to the
  repository clone, which Caddy mounts read-only.
- `website-builder` is a private long-running worker. Public-content changes
  are queued in PostgreSQL, merged during a short debounce window, and built
  into a new release directory. Caddy follows the `current` symlink only after
  the build finishes successfully, so visitors never receive a half-built site.
- `api` writes admin-uploaded images, MP4 videos, and PDF documents to `/srv/uploads`, which is
  a persistent bind mount from `UPLOADS_DIR`; Caddy serves those files at
  `/uploads/...`.

## First start

Run these commands from the repository clone on the VPS after DNS records have
propagated and after replacing every placeholder in `deploy/vps/.env`:

```bash
cd /srv/chashka-coffee/app
cp deploy/vps/.env.example deploy/vps/.env
mkdir -p /srv/chashka-coffee/uploads /srv/chashka-coffee/website-releases webapp/dist
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d postgres api
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm migrate
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d caddy
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm website-build
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm webapp-build
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d website-builder
```

The first Caddy start lets it issue certificates and expose the API before the
Astro static build requests published API data. Caddy serves an empty static
directory for only that initial build window.

If the interactive restaurant map is enabled, set
`PUBLIC_YANDEX_MAPS_API_KEY` in `deploy/vps/.env` before the website build.
This is a browser key, so restrict it in Yandex Maps by HTTP Referer to the
public dev and production website hosts. It is embedded in static HTML during
the build; rebuilding the website is required after changing it.

For Yandex Metrika, create a counter for the public website and set its numeric
ID as `PUBLIC_YANDEX_METRIKA_ID` in `deploy/vps/.env`. This value is public and
is embedded in the static website. The Metrika script and the existing
first-party page-view request start only after the visitor grants analytics
consent. Run `website-build` after adding or changing the counter ID.

Create the first administrator only after migrations have completed:

```bash
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm api \
  bun scripts/create-admin.ts admin@example.com 'choose-a-long-unique-password'
```

Do not run `bun run db:seed` on a manually maintained dev database: the seed
script deletes existing catalog records before adding demo data.

## Deploying an update

Deploy only a committed, pushed revision:

```bash
cd /srv/chashka-coffee/app
git pull --ff-only origin main
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml build api migrate
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm migrate
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d api
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm website-build
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm webapp-build
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d --force-recreate website-builder
```

`api` and `migrate` are separate Compose services. Rebuild both before running
migrations; otherwise `migrate` can use an older image and report success
without applying migrations added by the new revision. Recreate `api` only
after `prisma migrate deploy` completes successfully.

After the first release that includes media thumbnails, run this once before
opening the media picker. It is safe to repeat: files that already have a
thumbnail are skipped.

```bash
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm api bun run media:thumbnails:backfill
```

`website-builder` rebuilds the public Astro site automatically after changes to
catalog, restaurant/menu, page, homepage, content, job, or shared-site data.
Several changes made within `WEBSITE_BUILD_DEBOUNCE_SECONDS` become one build;
if content changes while a build is running, one follow-up build is queued. A
failed build leaves the previously published release live and retries after
`WEBSITE_BUILD_RETRY_SECONDS`.

Run `website-build` only after a code deployment or a changed `PUBLIC_*` URL.
Rebuild the appropriate frontend whenever a `PUBLIC_*` or `VITE_*` URL changes.

The first-party website analytics retention period is 365 days. Run the cleanup
task daily from the repository clone on the VPS (manually or from the host
scheduler):

```bash
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm api bun run start:cron -- analytics:cleanup
```

The task only deletes `page_views` older than the retention cutoff. It does not
delete leads, customers, orders, or Yandex Metrika data.

## Backups

PostgreSQL and `/srv/chashka-coffee/uploads` are the persistent data. Keep
daily backups outside this VPS and verify restoration before using the setup
for production. Docker volumes or snapshots on the same VPS are not an
independent backup.

Media URLs are stored as site-relative `/uploads/...` paths, so switching a
tested dev stack to the production domain does not require rewriting media
records. The `uploads` directory contains public images, videos, and PDFs; keep it in
the same external backup as PostgreSQL. Video files are publicly accessible,
and the admin library accepts browser-ready MP4 and PDF files only.
