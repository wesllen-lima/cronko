#!/usr/bin/env bash
set -euo pipefail

# Cronko database backup script
# Usage: ./scripts/backup.sh [DATABASE_URL]
# Default: reads DATABASE_URL from .env or environment

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="${BACKUP_DIR}/cronko-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
fi

DATABASE_URL="${1:-${DATABASE_URL:-}}"

if [ -z "${DATABASE_URL}" ]; then
  echo "Error: DATABASE_URL is required" >&2
  exit 1
fi

# Extract connection details from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
PGPASSWORD=$(echo "${DATABASE_URL}" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
PGHOST=$(echo "${DATABASE_URL}" | sed -n 's/.*@\([^:]*\).*/\1/p')
PGPORT=$(echo "${DATABASE_URL}" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
PGDB=$(echo "${DATABASE_URL}" | sed -n 's/.*\/\([^?]*\).*/\1/p')
PGUSER=$(echo "${DATABASE_URL}" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

export PGPASSWORD PGHOST PGPORT PGDB PGUSER

echo "Backing up ${PGDB}@${PGHOST}:${PGPORT} to ${BACKUP_FILE}"

pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT:-5432}" \
  --username="${PGUSER}" \
  --dbname="${PGDB}" \
  --no-owner \
  --no-privileges \
  --compress=9 \
  > "${BACKUP_FILE}"

echo "Backup complete: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"