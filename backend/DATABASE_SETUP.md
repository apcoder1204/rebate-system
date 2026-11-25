# Dual Database Setup Guide

The backend talks to two PostgreSQL databases at once: a **primary**, which is the source of truth for reads, and a **backup**, which receives a copy of every write. Which database plays which role depends on two environment variables:

| Mode | Settings | Primary | Backup |
|------|----------|---------|--------|
| **Production (current)** | `DEV_LOCAL_ONLY=false`, `LOCAL_IS_PRIMARY=true` | Local Postgres on the server | Neon |
| Neon-primary (old production / Render) | `DEV_LOCAL_ONLY=false`, `LOCAL_IS_PRIMARY` unset or `false` | Neon | Local Postgres |
| Local development | `DEV_LOCAL_ONLY=true` | Local Postgres | *none*: Neon is never touched |

All of this lives in `backend/src/db/connection.ts`. Controllers don't need to know which mode is active.

## Configuration

Add the following to `backend/.env`:

```env
# Neon: primary or backup depending on LOCAL_IS_PRIMARY
# IMPORTANT: use the pooler endpoint (contains -pooler. in the URL);
# the code adds pgbouncer=true automatically.
NEON_DATABASE_URL=postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Local PostgreSQL
DB_HOST=localhost          # 127.0.0.1 on the production server
DB_PORT=5432
DB_NAME=rebate_system
DB_USER=postgres           # rebate_app on the production server
DB_PASSWORD=<password>

# Role selection (see table above)
DEV_LOCAL_ONLY=true        # dev machines; false in production
LOCAL_IS_PRIMARY=false     # true in production
```

Never commit real credentials. The production values live only in `/var/www/rebate-backend/.env` on the server.

## How It Works

### Write operations
- Writes made through `pool.query(...)` (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`) run on **both** databases (`dualQuery`).
- The primary is the source of truth. If the write to the backup fails, a warning is logged and the primary write stands.
- If the primary has a dropped connection, the code reconnects and retries once before it gives up.

> **Known gaps: live mirroring is incomplete.**
> - `pool.connect()` returns a **primary-only** client. Transactions run on it (`createOrder`, `updateOrder`, role-request review) never reach the backup. `dualTransaction` has the same problem: its callback only receives the primary client.
> - Mirrored inserts that rely on `DEFAULT gen_random_uuid()` get a **different id in each database**, so later `UPDATE`/`DELETE ... WHERE id = …` statements miss those rows on the backup.
>
> In production, `backend/scripts/sync_to_neon.sh` repairs this with a full, verified copy to Neon every 8 hours, so Neon is at most 8 hours behind. See [DEPLOYMENT.md](../DEPLOYMENT.md#full-copy-to-neon-every-8-hours).

### Read operations
- Reads go to the primary.
- If the primary connection drops and reconnecting fails, reads fall back to the backup.

### Transactions
- `dualTransaction` opens a transaction on both databases and commits the primary first, but it runs your callback **only on the primary client**. The backup's transaction stays empty (see the known gaps above).

## Migration

```bash
npm run migrate
```

This runs automatically on every start (`npm start` = `npm run migrate && node dist/server.js`). It:
1. Applies `schema.sql` and every file in `src/db/migrations/` to the primary
2. Does the same on the backup
3. Creates a default admin account on each database, but only if that email doesn't already exist

The migration files use `IF NOT EXISTS`, so re-running them is safe.

## Copying data between the databases

### Full copy (recommended)
Use `pg_dump` / `pg_restore`. This is how production data was moved from Neon to the local primary:

```bash
pg_dump "$NEON_DATABASE_URL" -Fc --no-owner --no-acl -f neon.dump
PGPASSWORD=... pg_restore -h 127.0.0.1 -U rebate_app -d rebate_system --no-owner --no-acl neon.dump
```

Afterwards, compare per-table row counts on both sides.

### `npm run sync` scripts: limited
`npm run sync` / `sync:to-backup` (primary → backup) and `sync:to-primary` (backup → primary) are **not** a full copy:
- They cover only `users`, `contracts`, `orders`, `role_requests` and `verification_codes`
- They only **insert** rows whose `id` is missing (`ON CONFLICT DO NOTHING`)
- They never apply updates or deletes

## Connection Behaviour

The Neon pool is tuned for Neon's pooler and long idle periods:
- `idleTimeoutMillis: 60000`, `connectionTimeoutMillis: 15000`, `keepAlive: true`
- **Health check** (`SELECT 1` on the primary) every **30 seconds**
- **Connection warmer** every **1 minute**
- Automatic reconnect with retries when a connection drops

## Troubleshooting

### Neon connection failed
- Check `NEON_DATABASE_URL` and that it is the pooler endpoint (`-pooler.` in the URL)
- Check the Neon dashboard for an exceeded quota. This has happened before, and every Neon connection fails until it is resolved.
- In production, Neon is the backup, so the app keeps working and logs warnings

### Local Postgres connection failed
- `sudo systemctl status postgresql`
- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- If the backend runs in Docker, `localhost` inside the container is the container itself. The production compose file uses `network_mode: host` for exactly this reason.

### Both databases failed
- The request fails with an error. Check both configurations and network connectivity.

## Best Practices

1. **Know which database is primary** before you reason about where live data is: check `LOCAL_IS_PRIMARY` in the server's `.env`.
2. **Use `DEV_LOCAL_ONLY=true` on dev machines** so development never writes to production data.
3. **Rely on the daily `pg_dump` backups** (see [DEPLOYMENT.md](../DEPLOYMENT.md#6-databases-and-backups)) for restores, not on the sync scripts.
4. **Watch the logs** for `Backup database ... failed` warnings, which mean the two databases have stopped matching.
