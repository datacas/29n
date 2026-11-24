#!/usr/bin/env bash
# Reconstruye y reinicia la plataforma en el puerto 3099.
# El servidor corre desde .output-run (copia), así que otra compilación en .output no lo rompe.
set -euo pipefail
cd "$(dirname "$0")/.."
npx nuxt build
rm -rf .output-run && cp -r .output .output-run
PID=$(ss -ltnp 2>/dev/null | grep ':3099' | grep -o 'pid=[0-9]*' | cut -d= -f2 || true)
[ -n "${PID:-}" ] && kill "$PID" && sleep 1
HOST=127.0.0.1 PORT=3099 setsid nohup node .output-run/server/index.mjs > /tmp/nuxt-preview.log 2>&1 &
sleep 4
ss -ltn | grep -q ':3099' && echo "Plataforma en http://localhost:3099" || { echo "No arrancó; mira /tmp/nuxt-preview.log"; exit 1; }
