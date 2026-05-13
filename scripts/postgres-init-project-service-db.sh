#!/bin/bash
set -euo pipefail
exists="$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -Atc "SELECT 1 FROM pg_database WHERE datname = 'synaro_project_service'")"
if [ "$exists" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE synaro_project_service;"
fi
