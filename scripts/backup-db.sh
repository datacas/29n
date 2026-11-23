#!/usr/bin/env bash
# Copia completa de la base de datos en ~/backups/29n (formato pg_dump -Fc, permisos 600)
set -euo pipefail
DIR="${BACKUP_DIR:-$HOME/backups/29n}"; mkdir -p "$DIR"
F="$DIR/affinity-$(date +%Y%m%d-%H%M).dump"
/usr/bin/docker exec 29n-db-1 pg_dump -U app -d affinity --no-owner -Fc > "$F"; chmod 600 "$F"
echo "Copia guardada: $F"
echo "Restaurar: docker exec -i 29n-db-1 pg_restore -U app -d <base_nueva> --no-owner < $F"
