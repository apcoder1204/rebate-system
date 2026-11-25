# Deployment Guide for Rebate System

Current production setup (since 2026-11-25):

| Part | Where it runs |
|------|---------------|
| **Frontend** | Vercel, `https://rebate.cctvpoint.org` |
| **Backend API** | Docker container on our own Ubuntu server, `https://rebate-api.cctvpoint.org` |
| **Public entry** | Cloudflare Tunnel → Nginx (port 80) → container on `127.0.0.1:3000` |
| **Primary database** | PostgreSQL on the same Ubuntu server (db `rebate_system`, role `rebate_app`) |
| **Backup database** | Neon (cloud PostgreSQL). Gets most writes live, plus a **full verified copy every 8 hours** (01:30 / 09:30 / 17:30 UTC) that fills the gaps. See [§6](#full-copy-to-neon-every-8-hours) |
| **Cache / rate limits** | Redis container on the same server (`127.0.0.1:6380`). Upstash was replaced 2026-11-25: each call took ~270 ms (Cape Town) vs under 1 ms locally |
| **Email** | Resend |
| **File backups** | Daily `pg_dump` of the primary at 04:00 UTC, kept 30 days |

The old Render backend is no longer used. See [Render (legacy)](#7-render-legacy) before you shut it down.

---

## 1. Shared server: do not disturb the other app

The Ubuntu server also runs **dukani-pos** (`pos.cctvpoint.org`, `demo.cctvpoint.org`), an unrelated production app. Leave all of its parts alone:

- Nginx sites `dukani-pos` and `dukani-pos-demo`
- Its entries in `/etc/cloudflared/config.yml`
- Its Postgres role and database (`dukani` / `dukani_pos`)
- Its cron jobs (02:00 and 03:00) and `~/deploy.sh` / webhook receiver

Restarting **cloudflared** or **PostgreSQL** briefly interrupts dukani-pos too. Reloading **Nginx** (`systemctl reload nginx`) does not.

---

## 2. Server layout

You reach the server over SSH (via Tailscale) as user `cctvpoint`.

| Path | What it is |
|------|------------|
| `/var/www/rebate-backend/` | Backend code (synced from this repo's `backend/`) |
| `/var/www/rebate-backend/.env` | Production secrets, mode `600`. **Never commit or sync it.** |
| `/var/www/rebate-backend/docker-compose.yml` | Server-only compose file (see below) |
| `/var/www/rebate-backend/scripts/backup_db.sh` | Daily file backup (source: `backend/scripts/` in this repo) |
| `/var/www/rebate-backend/scripts/sync_to_neon.sh` | Full copy primary → Neon every 8 hours (source: `backend/scripts/`) |
| `/var/www/rebate-backend/uploads/` | Uploaded contract files (volume, survives rebuilds) |
| `~/backups/rebate/` | `pg_dump` files, `backup.log`, `neon_sync.log`, `neon_sync_status.json` |
| `/etc/nginx/sites-available/rebate-api` | Proxies `rebate-api.cctvpoint.org` to `127.0.0.1:3000` |
| `/etc/cloudflared/config.yml` | Tunnel route for `rebate-api.cctvpoint.org` → `http://localhost:80` |

The server's `docker-compose.yml`:

```yaml
services:
  backend:
    build: .
    env_file: .env
    # host network: reach the host Postgres, which only listens on localhost
    network_mode: host
    volumes:
      - ./uploads:/app/uploads
      - /home/cctvpoint/backups/rebate:/app/backups:ro
    depends_on:
      - redis
    restart: unless-stopped

  # Local Redis for rate limits and short-lived caches. Only reachable from this server.
  # Holds nothing permanent (60 s caches, rate-limit counters), so no persistence.
  redis:
    image: redis:7-alpine
    command:
      - sh
      - -c
      - exec redis-server --requirepass "$$REDIS_PASSWORD" --maxmemory 64mb --maxmemory-policy allkeys-lru --save "" --appendonly no
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6380:6379"
    restart: unless-stopped
```

To rebuild only the backend, run `docker compose up -d --build backend`. Restarting Redis clears the rate-limit counters and caches. That's harmless.

`network_mode: host` is deliberate. The shared Postgres only listens on `localhost`, and opening it to Docker's network would mean restarting Postgres, which would interrupt dukani-pos. So that the app is not exposed on the server's other addresses, `.env` sets `BIND_HOST=127.0.0.1`.

(The repo-root `docker-compose.yml` is a generic template using bridge networking. It is not the file the server runs.)

---

## 3. Backend environment variables

These go in `/var/www/rebate-backend/.env` on the server:

| Key | Production value | Purpose |
|-----|------------------|---------|
| `NODE_ENV` | `production` | Production mode |
| `DEV_LOCAL_ONLY` | `false` | `true` = local DB only, Neon never touched (dev machines only) |
| `LOCAL_IS_PRIMARY` | `true` | Local Postgres is primary, Neon is the backup (default `false` = the reverse) |
| `BIND_HOST` | `127.0.0.1` | Listen on loopback only (default `0.0.0.0`) |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `5432` | Local Postgres |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `rebate_system` / `rebate_app` / *(secret)* | Local Postgres credentials |
| `NEON_DATABASE_URL` | `postgresql://...-pooler...` | Neon. **Use the pooled URL.** |
| `REDIS_URL` | `redis://:<REDIS_PASSWORD>@127.0.0.1:6380` | Local Redis container. The old Upstash URL is kept commented out in `.env` for rollback |
| `REDIS_PASSWORD` | *(secret, generated)* | Password of the local Redis. Docker Compose also reads it to start the `redis` service |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | *(secret)*, `7d` | Auth tokens |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_NAME` | | Email |
| `FRONTEND_URL` | `rebate.cctvpoint.org` | Extra CORS origin |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | | Push notifications |
| `UPLOAD_DIR`, `MAX_FILE_SIZE` | `./uploads/contracts`, `10485760` | File uploads |
| `BACKUP_DIR` | `/app/backups` | Lets the admin system-health endpoint read backup file info |

---

## 4. Deploying a backend update

Test locally first. Then, from the repo root on your dev machine:

```bash
# 1. Copy the code (never the secrets, build output or uploads)
rsync -az --exclude node_modules --exclude .git --exclude dist \
  --exclude .env --exclude uploads \
  backend/ cctvpoint@<server>:/var/www/rebate-backend/

# 2. Rebuild and restart the container
ssh cctvpoint@<server> "cd /var/www/rebate-backend && docker compose up -d --build backend"
```

> **Do not add `--delete` to rsync.** `docker-compose.yml` and `.env` exist only on the server, and `--delete` would remove them. (`scripts/` now comes from `backend/scripts/` in the repo, so edit the scripts here and deploy them with the rsync above.)

`npm start` runs migrations on every start, against **both** databases. The migration files use `IF NOT EXISTS`, so re-running them is safe.

### Verify after every deploy

```bash
curl https://rebate-api.cctvpoint.org/api/health          # {"status":"ok",...}
ssh cctvpoint@<server> "docker logs rebate-backend-backend-1 --since 2m 2>&1 | grep -E 'connected|Error'"
# expect: ✅ Primary database (Local) connected
#         ✅ Backup database (Neon) connected
#         [Redis] Connected
ssh cctvpoint@<server> "curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: pos.cctvpoint.org' http://127.0.0.1/health"
# expect: 200 (dukani-pos untouched)
```

---

## 5. Frontend deployment (Vercel)

- Every push to `main` makes Vercel build automatically (`vercel.json`: `npm ci && npm run build`, output `dist`).
- In Vercel, set **Settings → Environment Variables**: `VITE_API_URL` = `https://rebate-api.cctvpoint.org/api` (it must end with `/api`).
- `VITE_*` values are baked in at build time. After changing one, **Redeploy** the latest deployment.
- Custom domain: `rebate.cctvpoint.org`.

---

## 6. Databases and backups

### How the two databases stay in sync
Writes made through the shared pool (`pool.query`, which uses `dualQuery` in `backend/src/db/connection.ts`) are sent to both the primary and the backup. Reads go to the primary. If the primary connection drops, reads fall back to the backup. If a write to the backup fails, it is logged as a warning and the primary write still stands.

### Known gap: the app's live mirroring is incomplete
Two flaws in the code mean Neon falls behind the primary between full copies:

1. **Transactional writes go to the primary only.** `createOrder`, `updateOrder` (orders and order items) and the role-request review (`users.role`) use `pool.connect()`, which returns a primary-only client. Those writes never reach Neon live.
2. **Each database generates its own IDs for mirrored inserts.** Inserts that rely on `DEFAULT gen_random_uuid()` give the same row a different `id` in each database, so a later `UPDATE ... WHERE id = …` uses the primary's id and matches nothing on Neon.

The full copy below repairs both every 8 hours, so **Neon is at most 8 hours behind**. The app code was left unchanged.

### Full copy to Neon every 8 hours
`scripts/sync_to_neon.sh` (source: `backend/scripts/sync_to_neon.sh`) makes Neon an exact copy of the primary. It only **reads** the primary.

- Cron (user `cctvpoint`): `30 1,9,17 * * * /var/www/rebate-backend/scripts/sync_to_neon.sh >> /home/cctvpoint/backups/rebate/neon_sync.log 2>&1`. That's 01:30 / 09:30 / 17:30 UTC (04:30 / 12:30 / 20:30 EAT), clear of the 02:00, 03:00 and 04:00 jobs.
- Each run:
  1. **Compares** a fingerprint of every `public` table on both sides. If they're identical, it skips: nothing is copied, and Neon is only woken for about 3 seconds.
  2. **Guard:** if Neon has an order, contract or user (`order_number` / `contract_number` / `email`) that the primary lacks, it **stops without copying** (status `blocked`). Nothing that exists only on Neon is ever overwritten.
  3. Exports the primary in **one consistent snapshot**.
  4. Uploads it to Neon schema `sync_staging` (live tables untouched) and checks the staged data matches the snapshot exactly.
  5. **Swaps** in one all-or-nothing transaction of about 7 seconds. First it saves Neon's current data to schema `sync_previous` (a rollback point, kept until the next copy). Then it empties the live tables and refills them from staging. While the swap runs, the app's writes to Neon wait. Writes to the primary are not affected.
  6. Verifies that Neon now matches the snapshot.
- A copy takes about 1 minute. Neon's own `neon_auth` schema is never touched.
- Result of the last run: `cat ~/backups/rebate/neon_sync_status.json`. `result` is `skipped`, `copied`, `blocked` or `failed`. History: `tail -50 ~/backups/rebate/neon_sync.log`.
- Check without copying: `CHECK_ONLY=1 /var/www/rebate-backend/scripts/sync_to_neon.sh`
- **If `blocked`:** something wrote to Neon that isn't on the primary (most likely the old Render backend, see §7). Find those rows and copy them to the primary by hand before the next run.
- **If `failed`:** Neon was left as it was. Read the log. "columns of table X differ" means a migration ran on one database but not the other.
- **Undo the last copy on Neon** (rarely needed): in one transaction, `TRUNCATE` the public tables, then `INSERT INTO public.<t> SELECT * FROM sync_previous.<t>`. Insert users first, then contracts, then orders, then the rest.

### Daily file backups
- Cron (user `cctvpoint`): `0 4 * * * /var/www/rebate-backend/scripts/backup_db.sh >> /home/cctvpoint/backups/rebate/backup.log 2>&1`
- Output: `~/backups/rebate/rebate_system_YYYYMMDD_HHMMSS.dump` (custom format). Files older than 30 days are deleted automatically.
- Check: `tail ~/backups/rebate/backup.log` and `ls -lh ~/backups/rebate/`

### Restoring from a dump (destructive, so get approval first)
```bash
cd /var/www/rebate-backend && docker compose stop backend      # stop writes
PGPASSWORD=<rebate_app password> pg_restore -h 127.0.0.1 -U rebate_app \
  -d rebate_system --clean --if-exists --no-owner --no-acl ~/backups/rebate/<file>.dump
docker compose start backend
```
A restore replaces the primary's data, but Neon keeps whatever it had. If Neon has orders that the restored dump lacks, the 8-hourly copy will report `blocked` and leave Neon alone. Decide which data is right before going further.

### Switching the primary back to Neon
Set `LOCAL_IS_PRIMARY=false` in the server `.env` and run `docker compose up -d --force-recreate`. **Before you do, run `scripts/sync_to_neon.sh` by hand** and make sure the result is `copied` or `skipped`, so Neon holds everything. Otherwise orders created since the last copy would disappear from the live system.

### Manual sync scripts: limitations
`npm run sync` / `sync:to-primary` (`backend/src/db/sync.ts`) cover only 5 tables and only **insert** missing rows. They don't apply updates or deletes. Don't treat them as a full copy. Use `pg_dump` / `pg_restore` for that.

---

## 7. Render (legacy)

The Render service `rebate-api` ran the backend before this migration. It may still exist as a fallback. If so:

- Its code still treats **Neon as primary** and writes to it directly. Any request that reaches Render's own `*.onrender.com` URL writes to Neon **without** going through the local primary, so the two databases drift apart.
- Pushes to `main` may still trigger Render auto-deploys.
- It still uses the old Upstash Redis (the new server no longer does).

Once you have confirmed the new server over a few days of real use, **suspend and then delete the Render service**.

---

## 8. Troubleshooting

| Symptom | Check |
|---------|-------|
| API unreachable | `docker ps`, `systemctl is-active nginx cloudflared docker` on the server; `curl http://127.0.0.1:3000/api/health` there |
| `Backup database ... connection failed` | Neon reachable? Neon quota exceeded? (This has happened before: see the Neon dashboard) |
| `Primary database (Local) ... failed` | `systemctl status postgresql`; check `DB_*` values in `.env` |
| `neon_sync_status.json` says `blocked` or `failed` | See [Full copy to Neon](#full-copy-to-neon-every-8-hours). Neon was not changed by that run |
| Logins get "Too many attempts" | Auth limit: 50 failed attempts per 15 min per IP + email. General API limit: 500 requests per 150 min per user (logged in) or per IP |
| Rate limits apply to everyone at once | Check that `app.set('trust proxy', 'loopback')` is still in `server.ts`. Without it, every visitor looks like `127.0.0.1` |
| CORS errors | `VITE_API_URL` must end in `/api`; the origin must match `rebate.cctvpoint.org` |
| Emails not sending | Resend domain verification; `RESEND_FROM_EMAIL` |
| Frontend changes not showing | Vercel build logs; redeploy after changing env vars |
