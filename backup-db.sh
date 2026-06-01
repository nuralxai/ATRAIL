#!/bin/bash
# Daily PostgreSQL backup — keeps last 7 days

BACKUP_DIR="/home/ubuntu/atrail-backups"
DB_CONTAINER="amgi_postgres"
DB_NAME="amgi"
DB_USER="postgres"
DATE=$(date '+%Y-%m-%d_%H-%M')
BACKUP_FILE="$BACKUP_DIR/atrail-db-$DATE.sql.gz"
LOG="/home/ubuntu/atrail/backup.log"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

log "Starting backup → $BACKUP_FILE"

# Dump and compress
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" 2>>"$LOG" | gzip > "$BACKUP_FILE"

if [ ${PIPESTATUS[0]} -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  log "✅ Backup complete — $SIZE → $BACKUP_FILE"
else
  log "❌ Backup FAILED"
  rm -f "$BACKUP_FILE"
fi

# Delete backups older than 7 days
DELETED=$(find "$BACKUP_DIR" -name "atrail-db-*.sql.gz" -mtime +7 -delete -print | wc -l)
[ "$DELETED" -gt 0 ] && log "🗑️  Removed $DELETED old backup(s)"

# Show current backups
log "Current backups: $(ls -1 $BACKUP_DIR/*.sql.gz 2>/dev/null | wc -l) files"
