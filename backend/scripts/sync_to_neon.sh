#!/bin/bash
# Keeps the Neon BACKUP database an exact copy of the local PRIMARY database.
# Cron runs it 3x a day (every 8 hours). It only READS the local primary.
#
# 1. Compare  Fingerprint every public table on both sides. Identical -> skip, nothing copied.
# 2. Guard    If Neon has an order / contract / user (by order_number / contract_number /
#             email) that the primary lacks -> stop, copy nothing, status "blocked".
# 3. Snapshot Export all tables from the primary in ONE consistent snapshot (+ fingerprint).
# 4. Stage    Upload into Neon schema `sync_staging` (live tables untouched, no locks),
#             then check the staged data matches the snapshot exactly.
# 5. Swap     One short transaction on Neon: save current data to `sync_previous`
#             (rollback point, kept until the next copy), empty the live tables, fill
#             them from staging. All-or-nothing: on any error Neon is left unchanged.
# 6. Verify   Neon fingerprint == snapshot fingerprint. Status -> neon_sync_status.json
#
# Neon's own `neon_auth` schema is never touched.
# CHECK_ONLY=1 ./sync_to_neon.sh -> steps 1-2 only, never copies.
set -eEuo pipefail

ENV_FILE=/var/www/rebate-backend/.env
BACKUP_DIR=/home/cctvpoint/backups/rebate
STATUS_FILE="$BACKUP_DIR/neon_sync_status.json"
LOCK_FILE=/tmp/rebate_sync_to_neon.lock

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) another run is still going, skipping"
  exit 0
fi

START=$(date +%s)
STARTED_AT=$(date -u +%FT%TZ)
WORK=$(mktemp -d /tmp/rebate_neon_sync.XXXXXX)
chmod 700 "$WORK"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

env_val() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']$//"; }
# Direct (unpooled) Neon endpoint, so our session settings never leak into the app's pooled connections.
NEON_URL=${TEST_NEON_URL:-$(env_val NEON_DATABASE_URL | sed -E 's/-pooler\././')}
if [ -n "${TEST_NEON_URL:-}" ]; then STATUS_FILE="$BACKUP_DIR/neon_sync_test_status.json"; fi
LOCAL_PW=$(env_val DB_PASSWORD)
export PGTZ=UTC PGDATESTYLE=ISO   # identical output formatting on both sides
export PGOPTIONS="-c client_min_messages=warning"   # direct endpoint only; keeps NOTICEs out of the log

local_q() { PGPASSWORD="$LOCAL_PW" psql -h 127.0.0.1 -U rebate_app -d rebate_system -X -Atq -v ON_ERROR_STOP=1 "$@"; }
neon_q()  { psql "$NEON_URL" -X -Atq -v ON_ERROR_STOP=1 "$@"; }

write_status() { # $1=result $2=message
  printf '{"result":"%s","checked_at":"%s","finished_at":"%s","duration_seconds":%s,"message":"%s"}\n' \
    "$1" "$STARTED_AT" "$(date -u +%FT%TZ)" "$(( $(date +%s) - START ))" "$2" > "$STATUS_FILE"
}
fail() { trap - ERR; write_status failed "$1; Neon left unchanged"; echo "=== FAILED: $1 ($(date -u +%FT%TZ)) ==="; exit 1; }
trap 'fail "error at line $LINENO"' ERR

echo "=== Neon check started: $STARTED_AT ==="

# ---- 1. Compare ----------------------------------------------------------------
TABLES=$(local_q -c "select string_agg(relname, ' ' order by relname) from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'")
fp_sql() { # $1 = schema. Column-order independent (jsonb keys are sorted).
  local sql="" t
  for t in $TABLES; do
    sql="${sql:+$sql union all }select '$t:' || count(*) || ':' || coalesce(md5(string_agg(j, E'\n' order by j collate \"C\")), '-') from (select to_jsonb(x)::text j from $1.\"$t\" x) s"
  done
  echo "select string_agg(v, ' ' order by v) from ($sql) s(v)"
}
LOCAL_FP=$(local_q -c "$(fp_sql public)")
NEON_FP=$(neon_q -c "$(fp_sql public)" 2>/dev/null) || fail "cannot read Neon (unreachable, or a table is missing there)"

if [ "$LOCAL_FP" = "$NEON_FP" ]; then
  if [ "${CHECK_ONLY:-0}" != "1" ]; then write_status skipped "no changes: Neon already identical to primary"; fi
  echo "No changes: Neon is identical to the primary. Nothing copied. ($(( $(date +%s) - START ))s)"
  exit 0
fi
echo "Differences found:"
diff <(tr ' ' '\n' <<<"$LOCAL_FP") <(tr ' ' '\n' <<<"$NEON_FP") | grep '^[<>]' \
  | sed -e 's/^</  primary:/' -e 's/^>/  neon:   /' || true

# ---- 2. Guard ------------------------------------------------------------------
GUARD=""
for spec in orders:order_number contracts:contract_number users:email; do
  t=${spec%%:*}; c=${spec##*:}
  local_q -c "select $c from public.$t where $c is not null" | LC_ALL=C sort -u > "$WORK/guard_l"
  neon_q  -c "select $c from public.$t where $c is not null" | LC_ALL=C sort -u > "$WORK/guard_n"
  missing=$(LC_ALL=C comm -13 "$WORK/guard_l" "$WORK/guard_n" | wc -l)
  if [ "$missing" -gt 0 ]; then GUARD="$GUARD $t:$missing"; fi
done
if [ -n "$GUARD" ]; then
  trap - ERR
  write_status blocked "Neon has records the primary lacks ($GUARD ); nothing copied, check manually"
  echo "BLOCKED: Neon has records the primary does not have:$GUARD"
  echo "Nothing copied. Investigate first (e.g. the old Render backend writing to Neon)."
  exit 2
fi
if [ "${CHECK_ONLY:-0}" = "1" ]; then
  echo "CHECK_ONLY=1: differences found, guard passed, nothing copied."
  exit 0
fi

# Same columns on both sides? (Both are migrated by the app; refuse to guess if not.)
cols() { "$1" -c "select string_agg(quote_ident(attname), ',' order by attname) from pg_attribute
  where attrelid = 'public.\"$2\"'::regclass and attnum > 0 and not attisdropped"; }
declare -A COLS
for t in $TABLES; do
  lc=$(cols local_q "$t"); nc=$(cols neon_q "$t")
  [ "$lc" = "$nc" ] || fail "columns of table $t differ between primary and Neon"
  COLS[$t]=$lc
done

# Parent tables before child tables (foreign keys).
EDGES=$(local_q -c "select c.relname || ':' || p.relname from pg_constraint k
  join pg_class c on c.oid = k.conrelid join pg_class p on p.oid = k.confrelid
  where k.contype = 'f' and k.connamespace = 'public'::regnamespace and k.conrelid <> k.confrelid")
ORDER=""; REMAIN="$TABLES"
while [ -n "${REMAIN// /}" ]; do
  NEXT=""; progress=0
  for t in $REMAIN; do
    ready=1
    for e in $EDGES; do
      [ "${e%%:*}" = "$t" ] || continue
      [[ " $ORDER " == *" ${e##*:} "* ]] || ready=0
    done
    if [ $ready = 1 ]; then ORDER="$ORDER $t"; progress=1; else NEXT="$NEXT $t"; fi
  done
  [ $progress = 1 ] || fail "circular foreign keys between tables:$NEXT"
  REMAIN="$NEXT"
done

# ---- 3. Snapshot (one consistent read of the primary) --------------------------
{
  echo "begin isolation level repeatable read read only;"
  echo "\\copy ($(fp_sql public)) to '$WORK/snapshot_fp'"
  for t in $TABLES; do echo "\\copy (select ${COLS[$t]} from public.\"$t\") to '$WORK/$t.copy'"; done
  echo "commit;"
} > "$WORK/export.sql"
local_q -f "$WORK/export.sql"
SNAP_FP=$(cat "$WORK/snapshot_fp")
echo "Primary snapshot exported: $(cat "$WORK"/*.copy | wc -c) bytes"

# ---- 4. Stage (live tables untouched) ------------------------------------------
{
  echo "drop schema if exists sync_staging cascade; create schema sync_staging;"
  for t in $TABLES; do
    echo "create table sync_staging.\"$t\" (like public.\"$t\");"
    echo "\\copy sync_staging.\"$t\" (${COLS[$t]}) from '$WORK/$t.copy'"
  done
} > "$WORK/stage.sql"
neon_q -f "$WORK/stage.sql"
STAGE_FP=$(neon_q -c "$(fp_sql sync_staging)")
[ "$STAGE_FP" = "$SNAP_FP" ] || fail "staged data on Neon does not match the primary snapshot"
echo "Staged on Neon and checked identical to the snapshot"

# ---- 5. Swap (one short all-or-nothing transaction) ----------------------------
ALL=$(for t in $TABLES; do printf 'public."%s",' "$t"; done); ALL=${ALL%,}
{
  echo "begin;"
  echo "set local lock_timeout = '15s';"
  echo "drop schema if exists sync_previous cascade; create schema sync_previous;"
  for t in $TABLES; do echo "create table sync_previous.\"$t\" as table public.\"$t\";"; done
  echo "truncate $ALL;"
  for t in $ORDER; do
    echo "insert into public.\"$t\" (${COLS[$t]}) select ${COLS[$t]} from sync_staging.\"$t\";"
  done
  echo "commit;"
} > "$WORK/swap.sql"
SWAP_START=$(date +%s.%N)
neon_q -f "$WORK/swap.sql"
SWAP_SECS=$(printf '%.1f' "$(echo "$(date +%s.%N) - $SWAP_START" | bc)")
echo "Swapped in ${SWAP_SECS}s (previous Neon data kept in schema sync_previous)"
neon_q -c "drop schema if exists sync_staging cascade"

# ---- 6. Verify -----------------------------------------------------------------
trap - ERR
NEON_FP=$(neon_q -c "$(fp_sql public)")
if [ "$NEON_FP" = "$SNAP_FP" ]; then
  write_status copied "copied and verified identical to the primary snapshot (swap ${SWAP_SECS}s)"
  echo "=== Copied and verified ($(( $(date +%s) - START ))s) ==="
else
  # Possible only if the app mirrored a write into Neon right after the swap.
  write_status copied "copied; Neon changed again right after the swap, next run re-checks"
  echo "=== Copied; Neon changed right after the swap, next run re-checks ($(( $(date +%s) - START ))s) ==="
fi
