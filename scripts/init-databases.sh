#!/bin/bash
# Creates all necessary databases for Synaro services
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE synaro_frontend;
  CREATE DATABASE synaro_project_service;
  GRANT ALL PRIVILEGES ON DATABASE synaro_frontend TO synaro_user;
  GRANT ALL PRIVILEGES ON DATABASE synaro_project_service TO synaro_user;
EOSQL

echo "Databases created successfully"
