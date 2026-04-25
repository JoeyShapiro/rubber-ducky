#!/bin/bash
set -e

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD is required" >&2
  exit 1
fi

if [ -z "$PASSWORD" ]; then
  echo "ERROR: PASSWORD is required" >&2
  exit 1
fi

su -c "/usr/lib/postgresql/15/bin/pg_ctl \
    -D /var/lib/postgresql/data \
    -l /var/lib/postgresql/postgres.log start" postgres

until su -c "pg_isready -q" postgres; do sleep 1; done

su -c "psql -c \"ALTER USER postgres WITH PASSWORD '${POSTGRES_PASSWORD}'\"" postgres

bun /app/run-migrate.ts

exec bun build/index.js
