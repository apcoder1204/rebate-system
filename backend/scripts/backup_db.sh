#!/bin/bash
set -euo pipefail

BACKUP_DIR=/home/cctvpoint/backups/rebate
RETENTION_DAYS=30
ENV_FILE=/var/www/rebate-backend/.env

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PASS=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

echo "=== Backup started: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
PGPASSWORD="$DB_PASS" pg_dump -h 127.0.0.1 -U rebate_app -d rebate_system -Fc \
  -f "$BACKUP_DIR/rebate_system_${TIMESTAMP}.dump"
echo "Backup written: rebate_system_${TIMESTAMP}.dump"

# Prune backups older than retention period
find "$BACKUP_DIR" -name 'rebate_system_*.dump' -mtime +$RETENTION_DAYS -delete
echo "=== Backup finished: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
