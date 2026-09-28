# Parallel VPS production launch

This runbook preserves the existing DEV stack while adding production on the
same VPS. Do not run `docker compose down -v`, remove volumes, seed production,
or point production at DEV PostgreSQL or uploads. Do not change the apex DNS
until the preflight below passes. Run commands from a clean, pushed `main`
revision; never reset or clean a dirty checkout to make a deployment possible.

## Layout and ownership

| Surface | DEV | PROD |
| --- | --- | --- |
| Compose project | `chashka-coffee-dev` | `chashka-coffee-prod` |
| Checkout | `/srv/chashka-coffee/app` | `/srv/chashka-coffee/prod/app` |
| Env | `deploy/vps/.env` | `deploy/vps/.env.prod` |
| PostgreSQL | `chashka-coffee-dev_postgres_data` | `chashka-coffee-prod_postgres_data` |
| Uploads | `/srv/chashka-coffee/uploads` | `/srv/chashka-coffee/prod/uploads` |
| Astro releases | `/srv/chashka-coffee/website-releases` | `/srv/chashka-coffee/prod/website-releases` |
| Admin build | DEV checkout `webapp/dist` | PROD checkout `webapp/dist` |

Only `chashka-coffee-dev-caddy-1` publishes ports 80 and 443. It is attached
to the DEV network and the dedicated `chashka-coffee-proxy` network. The PROD
API is attached to the proxy network and its own Compose network; its
PostgreSQL is available only on the latter. Neither PostgreSQL nor API
publishes a host port. DEV and PROD builds use separate checkouts, so their
dependency installs, staging files, and generated outputs cannot collide.
Astro stages each PROD build inside its checkout before copying the completed
release to the persistent releases mount; this keeps Astro's internal renames
on one filesystem.

## First launch preflight and backup

Before changing infrastructure, record `docker ps`, `docker compose ls`,
`docker volume ls`, `docker network ls`, mounts, cron/systemd jobs, `git status`,
`git rev-parse HEAD`, `git remote -v`, and disk space. Identify actual DEV paths
from mounts and `.env`, rather than assuming the paths in this document. Keep
the old site's DNS IP and hosting active for rollback.

Take a custom-format DEV dump and an uploads archive outside Docker volumes.
Store them with root-only permissions and verify `pg_restore --list` and
`tar --list` before continuing. The dump must succeed before restoring PROD.
Take an off-VPS copy when an independent backup destination is available; a
copy on the same disk does not protect against VPS loss.

## Prepare the separate production stack

After the production changes are committed and pushed, verify both checkouts
are clean and in sync with `origin/main`. Do not continue if either checkout
has local modifications or a different release commit.

```bash
cd /srv/chashka-coffee/app
git status --short --branch
git remote -v
git pull --ff-only origin main
mkdir -p /srv/chashka-coffee/prod/uploads /srv/chashka-coffee/prod/website-releases
docker network inspect chashka-coffee-proxy >/dev/null 2>&1 || docker network create chashka-coffee-proxy
git clone https://github.com/kanzlerath/chashka-coffee.git /srv/chashka-coffee/prod/app
cd /srv/chashka-coffee/prod/app
git status --short --branch
git rev-parse HEAD
```

Create the real production env by copying the existing DEV env through the
repository script. It generates a fresh PostgreSQL password and JWT secret,
changes all domain and storage values, and refuses to overwrite an existing
production env. It preserves currently configured PremiumBonus, Telegram,
Yandex Maps, Yandex Metrika, and **test-mode** YooKassa credentials as
requested. DEV and PROD visits share one Metrika counter. Never print or commit
the resulting file.
Confirm the Yandex Maps referer allowlist includes `chashkacoffee.ru`, and
arrange a production YooKassa test webhook without
breaking DEV's webhook before testing payments.

```bash
docker run --rm \
  -v /srv/chashka-coffee:/srv/chashka-coffee \
  -w /srv/chashka-coffee/prod/app \
  oven/bun:1.3.14 \
  bun deploy/vps/scripts/prepare-prod-env.mjs \
    /srv/chashka-coffee/app/deploy/vps/.env \
    /srv/chashka-coffee/prod/app/deploy/vps/.env.prod
chmod 600 /srv/chashka-coffee/prod/app/deploy/vps/.env.prod
mkdir -p /srv/chashka-coffee/prod/app/webapp/dist
cd /srv/chashka-coffee/prod/app
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml config -q
```

Copying integrations does not copy user sessions: the new JWT secret
intentionally requires fresh sign-in. Confirm the production env has
`COOKIE_SECURE=true` and `YOOKASSA_TEST_MODE=true` without showing secrets.

Start only the empty PROD database, then restore the verified DEV dump. Use
the exact backup filename from the preflight. Do not run `db:seed` or
`prisma migrate dev`. The DEV dump includes historical `page_views` with DEV
referrers. The approved PROD-only cleanup clears that analytics table after
restore, before the production API starts; DEV analytics stays untouched.

```bash
cd /srv/chashka-coffee/prod/app
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml up -d postgres
for attempt in $(seq 1 30); do
  test "$(docker inspect --format '{{.State.Health.Status}}' chashka-coffee-prod-postgres-1)" = healthy && break
  sleep 2
done
test "$(docker inspect --format '{{.State.Health.Status}}' chashka-coffee-prod-postgres-1)" = healthy
docker exec -i chashka-coffee-prod-postgres-1 sh -ec \
  'exec pg_restore --no-owner --no-acl --single-transaction --exit-on-error --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  < /srv/chashka-coffee/backups/dev-db-YYYY-MM-DD-HHMM.dump
docker exec -i chashka-coffee-prod-postgres-1 sh -ec \
  'exec psql -X -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  < deploy/vps/clear-prod-analytics.sql
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml build api migrate
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml run --rm migrate
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml up -d api
```

Restore uploads to the separate PROD path without replacing DEV files. The
backup archive has `uploads/` as its top-level directory:

```bash
tar --extract --file=/srv/chashka-coffee/backups/dev-uploads-YYYY-MM-DD-HHMM.tar \
  --directory=/srv/chashka-coffee/prod --no-same-owner
```

Verify file counts, bytes, ownership, and API write access in PROD. Run a
second `rsync -a` from DEV uploads to PROD only if content changed between the
backup and launch; never use `--delete`. Do not mass-rewrite media URLs in the
database. Inspect any absolute DEV media URLs first.

Compare entity counts with the repository query after restore and migrations.
It prints only entity names and counts, not records or personal data. If DEV
content changes after the dump, compare PROD with the captured backup baseline
rather than the newer live DEV state.

```bash
cd /srv/chashka-coffee/prod/app
docker exec -i chashka-coffee-dev-postgres-1 sh -ec \
  'exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-align --tuples-only' \
  < deploy/vps/data-counts.sql
docker exec -i chashka-coffee-prod-postgres-1 sh -ec \
  'exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-align --tuples-only' \
  < deploy/vps/data-counts.sql
```

## Connect the single Caddy

The updated DEV Compose file mounts PROD static releases, admin output, and
uploads read-only, and joins the proxy network. Validate the Caddyfile before
recreating only Caddy. This causes a brief reverse-proxy reconnection but
does not restart DEV API, worker, or PostgreSQL.

```bash
cd /srv/chashka-coffee/app
docker cp deploy/vps/Caddyfile chashka-coffee-dev-caddy-1:/tmp/Caddyfile.candidate
docker exec chashka-coffee-dev-caddy-1 caddy validate --config /tmp/Caddyfile.candidate
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml config -q
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d --no-deps --force-recreate caddy
```

Recheck all three DEV hosts immediately. The public DEV site and admin retain
`X-Robots-Tag: noindex, nofollow, noarchive`; DEV API also gains it. The PROD
public site has no global noindex header, while PROD admin and API do.

Point only `api.chashkacoffee.ru` and `admin.chashkacoffee.ru` to the VPS
before the apex cutover. Confirm Caddy certificates, PROD `/health`, and the
admin login. The Astro build requests the production API while prerendering;
the API hostname and TLS must work before running `website-build`.

```bash
cd /srv/chashka-coffee/prod/app
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml run --rm website-build
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml run --rm webapp-build
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml up -d website-builder
```

Search both production outputs for `dev.chashkacoffee.ru`,
`api-dev.chashkacoffee.ru`, and `admin-dev.chashkacoffee.ru`; no match is
allowed. Check canonical, OpenGraph URL, sitemap, robots.txt, and private-page
noindex rules. Test website routes and media locally or with a suitable
preview before changing apex DNS. Test admin content, uploads, auth, CORS,
forms, account, and configured integrations. Avoid real customer actions or
production payment charges during smoke tests.

## DNS cutover and rollback

Set `api` and `admin` A records to the VPS first. Leave `dev`, `api-dev`, and
`admin-dev` unchanged. Only after the preflight passes, change the apex A
record to the VPS and make `www` a CNAME to the apex (or A record to the VPS).
The Caddyfile permanently redirects `www` to the apex while preserving path
and query. Keep the previous apex IP, old hosting, backups, and DEV intact.

If the new public site fails, restore the previous apex DNS IP. DNS rollback
does not revert changes already made to the separate PROD database. For an
Astro-only regression, atomically point
`/srv/chashka-coffee/prod/website-releases/current` to the prior release. For
a database recovery, stop only PROD writers and restore a verified PROD backup
into a separate recovery database before choosing a restore point; never
restore a DEV dump over a live PROD database without an explicit data-loss
decision. Do not change DEV during production rollback.

## Subsequent deploys

Run from the intended clean, pushed `main` revision. The production worker is
stopped before updating its bind-mounted checkout so it cannot build from a
partially updated source tree. DEV containers and data are untouched:

```bash
cd /srv/chashka-coffee/prod/app
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml stop website-builder
git status --short --branch
git pull --ff-only origin main
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml build api migrate
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml run --rm migrate
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml up -d api
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml run --rm website-build
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml run --rm webapp-build
docker compose --env-file deploy/vps/.env.prod -f deploy/vps/compose.prod.yaml up -d --force-recreate website-builder
```

Use the DEV commands in [README.md](./README.md) for a DEV deploy. A production
deploy must never use DEV's env, Compose file, releases, or database.
