#!/usr/bin/env bash
set -euo pipefail

# Cronko database restore script
# Usage: ./scripts/restore.sh <backup-file.sql.gz> [DATABASE_URL]

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: ./scripts/restore.sh <backup-file.sql.gz> [DATABASE_URL]" >&2
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
fi

DATABASE_URL="${2:-${DATABASE_URL:-}}"

if [ -z "${DATABASE_URL}" ]; then
  echo "Error: DATABASE_URL is required" >&2
  exit 1
fi

PGPASSWORD=$(echo "${DATABASE_URL}" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
PGHOST=$(echo "${DATABASE_URL}" | sed -n 's/.*@\([^:]*\).*/\1/p')
PGPORT=$(echo "${DATABASE_URL}" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
PGDB=$(echo "${DATABASE_URL}" | sed -n 's/.*\/\([^?]*\).*/\1/p')
PGUSER=$(echo "${DATABASE_URL}" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

export PGPASSWORD PGHOST PGPORT PGDB PGUSER

echo "Restoring ${BACKUP_FILE} to ${PGDB}@${PGHOST}:${PGPORT}"

gunzip -c "${BACKUP_FILE}" | psql \
  --host="${PGHOST}" \
  --port="${PGPORT:-5432}" \
  --username="${PGUSER}" \
  --dbname="${PGDB}" \
  --single-transaction

echo "Restore complete."