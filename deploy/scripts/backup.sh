#!/usr/bin/env bash
# Nightly backup: MySQL dump + media volume tarball.
# Retention: 7 daily + 4 weekly (copied on Sundays). Optional off-site upload
# via rclone when BACKUP_RCLONE_REMOTE is set in /opt/paradise/.env.
# Cron (root): 30 3 * * * /opt/paradise/deploy/scripts/backup.sh >> /var/log/paradise-backup.log 2>&1
set -euo pipefail

# Root cron runs with a minimal PATH — make docker/rclone resolvable.
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

APP_DIR="${APP_DIR:-/opt/paradise}"
BACKUP_DIR="$APP_DIR/backups"
COMPOSE=(docker compose -f "$APP_DIR/docker-compose.prod.yml" --project-directory "$APP_DIR")
STAMP="$(date +%F)"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

trap 'rm -f "$BACKUP_DIR/daily/db-$STAMP.sql.gz.tmp" "$BACKUP_DIR/daily/media-$STAMP.tar.gz.tmp"' EXIT

# --- MySQL dump (credentials come from the container's own environment) ----
"${COMPOSE[@]}" exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_DIR/daily/db-$STAMP.sql.gz.tmp"

mv "$BACKUP_DIR/daily/db-$STAMP.sql.gz.tmp" "$BACKUP_DIR/daily/db-$STAMP.sql.gz"

# --- Media volume -----------------------------------------------------------
docker run --rm \
  -v paradise_media:/data:ro \
  -v "$BACKUP_DIR/daily":/backup \
  alpine:3.20 tar czf "/backup/media-$STAMP.tar.gz.tmp" -C /data .

mv "$BACKUP_DIR/daily/media-$STAMP.tar.gz.tmp" "$BACKUP_DIR/daily/media-$STAMP.tar.gz"

# --- Weekly copies (Sundays) ------------------------------------------------
if [ "$(date +%u)" = "7" ]; then
    cp "$BACKUP_DIR/daily/db-$STAMP.sql.gz" "$BACKUP_DIR/weekly/"
    cp "$BACKUP_DIR/daily/media-$STAMP.tar.gz" "$BACKUP_DIR/weekly/"
fi

# --- Retention ---------------------------------------------------------------
find "$BACKUP_DIR/daily" -type f -mtime +7 -delete
find "$BACKUP_DIR/weekly" -type f -mtime +28 -delete

# --- Optional off-site upload (S3-compatible storage in Kazakhstan) ----------
RCLONE_REMOTE="$(grep -E '^BACKUP_RCLONE_REMOTE=' "$APP_DIR/.env" | cut -d= -f2- || true)"
if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null; then
    rclone copy "$BACKUP_DIR/daily/db-$STAMP.sql.gz" "$RCLONE_REMOTE/daily/"
    rclone copy "$BACKUP_DIR/daily/media-$STAMP.tar.gz" "$RCLONE_REMOTE/daily/"
fi

echo "[$(date -Is)] backup complete: db-$STAMP.sql.gz, media-$STAMP.tar.gz"
