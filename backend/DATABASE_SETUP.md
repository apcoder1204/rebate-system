# Dual Database Setup Guide

This project uses a dual database configuration:
- **Primary Database**: Neon (cloud PostgreSQL)
- **Backup Database**: Localhost PostgreSQL

## Configuration

### Environment Variables

Add the following to your `.env` file in the `backend` directory:

```env
# Primary Database (Neon) - REQUIRED
NEON_DATABASE_URL=postgresql://neondb_owner:****************@ep-dry-cloud-agiicyd1-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Backup Database (Localhost) - Optional (defaults shown)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rebate_system
DB_USER=postgres
DB_PASSWORD=postgres
```

**Important**: Replace the `****************` in `NEON_DATABASE_URL` with your actual Neon database password.

## How It Works

### Write Operations
- All write operations (INSERT, UPDATE, DELETE) are executed on **both** databases
- Primary (Neon) is the source of truth
- Backup (localhost) is kept in sync automatically
- If primary fails, operations continue on backup
- If backup fails, operations continue on primary (with warning)

### Read Operations
- Read operations default to primary (Neon) for performance
- If primary fails, automatically falls back to backup

### Data Safety
- **No data is deleted** from either database
- Both databases maintain independent copies
- Sync operations use `ON CONFLICT DO NOTHING` to prevent duplicates

## Migration

Run migrations on both databases:

```bash
npm run migrate
```

This will:
1. Create schema on Neon (primary)
2. Create schema on localhost (backup)
3. Create default admin user on both databases

## Manual Sync

If you need to manually sync data between databases:

### Sync from Neon to Localhost (default)
```bash
npm run sync
# or
npm run sync:to-backup
```

### Sync from Localhost to Neon
```bash
npm run sync:to-primary
```

**Note**: Sync operations only insert new records. Existing records are skipped to prevent duplicates.

## Database Connection

The system automatically:
- Connects to both databases on startup
- Tests connections and logs status
- Falls back gracefully if one database is unavailable
- Logs warnings for backup failures (doesn't stop operations)

## Troubleshooting

### Primary Database (Neon) Connection Failed
- Check your `NEON_DATABASE_URL` in `.env`
- Verify your Neon database is running
- Check network connectivity
- System will continue using backup database

### Backup Database (Localhost) Connection Failed
- Ensure PostgreSQL is running locally
- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` in `.env`
- System will continue using primary database only
- Warning will be logged but operations continue

### Both Databases Failed
- System will throw an error
- Check both database configurations
- Verify network connectivity

## Best Practices

1. **Always keep Neon as primary** - It's your production database
2. **Use localhost for development** - Faster for local testing
3. **Run sync regularly** - Keep backup in sync: `npm run sync`
4. **Monitor logs** - Watch for connection warnings
5. **Backup before major changes** - Use sync to create backups

## API Behavior

All API endpoints automatically:
- Write to both databases
- Read from primary (fallback to backup if needed)
- Handle errors gracefully
- Log warnings for backup failures

No code changes needed in controllers - the dual database system is transparent!



