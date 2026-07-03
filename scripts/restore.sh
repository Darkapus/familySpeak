#!/bin/bash
set -euo pipefail

ARCHIVE="${1:-}"
DATA_DIR="${DATA_DIR:-./data}"

if [ -z "$ARCHIVE" ]; then
  echo "Usage: ./restore.sh <chemin-vers-archive.tar.gz>"
  exit 1
fi

echo "Arrête d'abord les conteneurs : docker compose down"
read -p "Continuer la restauration dans $DATA_DIR ? (o/N) " confirm
if [ "$confirm" != "o" ]; then
  echo "Annulé."
  exit 0
fi

mkdir -p "$DATA_DIR"
tar xzf "$ARCHIVE" -C "$DATA_DIR"

echo "Restauration terminée. Redémarre les conteneurs : docker compose up -d"
