#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

tar czf "$BACKUP_DIR/familyspeak-$DATE.tar.gz" -C "$DATA_DIR" db media

find "$BACKUP_DIR" -name "familyspeak-*.tar.gz" -mtime "+$RETENTION_DAYS" -delete

echo "Backup créé : $BACKUP_DIR/familyspeak-$DATE.tar.gz"
