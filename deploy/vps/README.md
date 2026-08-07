# VPS dev deployment

This directory is the self-managed VPS path for the current static website,
static admin app, Bun API, and PostgreSQL. It is deliberately separate from
the repository-root `docker-compose.yml`, which is local-development-only.

## Services

- `postgres` is reachable only on the internal Compose network.
- `api` is reachable only through Caddy at `API_HOST`.
- `caddy` publishes ports 80 and 443, owns TLS certificates, and serves the
  built website and admin app.
- `website-build` and `webapp-build` are one-shot Bun containers. They write
  static output to the repository clone, which Caddy mounts read-only.
- `api` writes admin-uploaded media to `/srv/uploads`, which is a persistent
  bind mount from `UPLOADS_DIR`; Caddy serves those files at `/uploads/...`.

## First start

Run these commands from the repository clone on the VPS after DNS records have
propagated and after replacing every placeholder in `deploy/vps/.env`:

```bash
cd /srv/chashka-coffee/app
cp deploy/vps/.env.example deploy/vps/.env
mkdir -p /srv/chashka-coffee/uploads website/dist webapp/dist
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d postgres api
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm migrate
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d caddy
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm website-build
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm webapp-build
```

The first Caddy start lets it issue certificates and expose the API before the
Astro static build requests published API data. Caddy serves an empty static
directory for only that initial build window.

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
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml build api
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm migrate
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d api
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm website-build
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml run --rm webapp-build
```

Rebuild the website after published static content changes, because Astro reads
that content during its build. Rebuild the appropriate frontend whenever a
`PUBLIC_*` or `VITE_*` URL changes.

## Backups

PostgreSQL and `/srv/chashka-coffee/uploads` are the persistent data. Keep
daily backups outside this VPS and verify restoration before using the setup
for production. Docker volumes or snapshots on the same VPS are not an
independent backup.

Media URLs are stored as site-relative `/uploads/...` paths, so switching a
tested dev stack to the production domain does not require rewriting media
records. The `uploads` directory contains public images only; keep it in the
same external backup as PostgreSQL.
