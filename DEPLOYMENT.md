# Deployment Guide for Rebate System

Current production setup (since 2026-11-25):

| Part | Where it runs |
|------|---------------|
| **Frontend** | Vercel, `https://rebate.cctvpoint.org` |
| **Backend API** | Docker container on our own Ubuntu server, `https://rebate-api.cctvpoint.org` |
| **Public entry** | Cloudflare Tunnel → Nginx (port 80) → container on `127.0.0.1:3000` |
| **Primary database** | PostgreSQL on the same Ubuntu server (db `rebate_system`, role `rebate_app`) |
| **Backup database** | Neon (cloud PostgreSQL), receives a copy of *most* writes. **Not a complete mirror:** see [§6](#known-gap-neon-is-not-a-complete-mirror) |
| **Cache / rate limits** | Upstash Redis |
| **Email** | Resend |
| **File backups** | Daily `pg_dump` of the primary at 04:00, kept 30 days |

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
| `/var/www/rebate-backend/scripts/backup_db.sh` | Daily backup script (server-only) |
| `/var/www/rebate-backend/uploads/` | Uploaded contract files (volume, survives rebuilds) |
| `~/backups/rebate/` | `pg_dump` files plus `backup.log` |
| `/etc/nginx/sites-available/rebate-api` | Proxies `rebate-api.cctvpoint.org` to `127.0.0.1:3000` |
| `/etc/cloudflared/config.yml` | Tunnel route for `rebate-api.cctvpoint.org` → `http://localhost:80` |

The server's `docker-compose.yml`:

```yaml
services:
  backend:
    build: .
    env_file: .env
    network_mode: host          # reach the host's Postgres, which only listens on localhost
    volumes:
      - ./uploads:/app/uploads
      - /home/cctvpoint/backups/rebate:/app/backups:ro
    restart: unless-stopped
```

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
| `REDIS_URL` | `rediss://...` | Upstash |
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
ssh cctvpoint@<server> "cd /var/www/rebate-backend && docker compose up -d --build"
```

> **Do not add `--delete` to rsync.** `docker-compose.yml`, `scripts/` and `.env` exist only on the server, and `--delete` would remove them.

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

### Known gap: Neon is not a complete mirror
Two flaws in the code mean Neon will fall behind the primary once new writes happen:

1. **Transactional writes go to the primary only.** `createOrder`, `updateOrder` (orders and order items) and the role-request review (`users.role`) use `pool.connect()`, which returns a primary-only client. Those writes never reach Neon.
2. **Each database generates its own IDs for mirrored inserts.** Inserts that rely on `DEFAULT gen_random_uuid()` give the same row a different `id` in each database, so a later `UPDATE ... WHERE id = …` uses the primary's id and matches nothing on Neon.

As of 2026-11-25 both databases were still identical, ID for ID, because there had been no writes since the switchover. **Until this is fixed, the daily `pg_dump` files are the only complete backup.** Do not switch the primary back to Neon without first re-copying the data with `pg_dump` / `pg_restore`. A robust fix is to replace dual-writes with PostgreSQL logical replication (local → Neon), or to run a scheduled full `pg_dump` → Neon restore.

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
A restore replaces the primary's data, but Neon keeps whatever it had. Afterwards, compare row counts between the two before relying on Neon again.

### Switching the primary back to Neon
Set `LOCAL_IS_PRIMARY=false` in the server `.env` and run `docker compose up -d --force-recreate`. **Before you do, refresh Neon from the primary** (`pg_dump` the local database and restore it into Neon, see the known gap above), then compare IDs and row counts on both sides. Otherwise any orders created since the switchover would disappear from the live system.

### Manual sync scripts: limitations
`npm run sync` / `sync:to-primary` (`backend/src/db/sync.ts`) cover only 5 tables and only **insert** missing rows. They don't apply updates or deletes. Don't treat them as a full copy. Use `pg_dump` / `pg_restore` for that.

---

## 7. Render (legacy)

The Render service `rebate-api` ran the backend before this migration. It may still exist as a fallback. If so:

- Its code still treats **Neon as primary** and writes to it directly. Any request that reaches Render's own `*.onrender.com` URL writes to Neon **without** going through the local primary, so the two databases drift apart.
- Pushes to `main` may still trigger Render auto-deploys.
- It shares the same Upstash Redis.

Once you have confirmed the new server over a few days of real use, **suspend and then delete the Render service**.

---

## 8. Troubleshooting

| Symptom | Check |
|---------|-------|
| API unreachable | `docker ps`, `systemctl is-active nginx cloudflared docker` on the server; `curl http://127.0.0.1:3000/api/health` there |
| `Backup database ... connection failed` | Neon reachable? Neon quota exceeded? (This has happened before: see the Neon dashboard) |
| `Primary database (Local) ... failed` | `systemctl status postgresql`; check `DB_*` values in `.env` |
| Logins get "Too many attempts" | Auth limit: 50 failed attempts per 15 min per IP + email. General API limit: 500 requests per 150 min per user (logged in) or per IP |
| Rate limits apply to everyone at once | Check that `app.set('trust proxy', 'loopback')` is still in `server.ts`. Without it, every visitor looks like `127.0.0.1` |
| CORS errors | `VITE_API_URL` must end in `/api`; the origin must match `rebate.cctvpoint.org` |
| Emails not sending | Resend domain verification; `RESEND_FROM_EMAIL` |
| Frontend changes not showing | Vercel build logs; redeploy after changing env vars |
