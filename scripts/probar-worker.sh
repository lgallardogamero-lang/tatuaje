#!/usr/bin/env bash
# Compila el Worker real de Cloudflare y lo ejecuta en local (D1, R2 y la cola simulados), en el puerto 3000.
# Sirve para lanzar las pruebas de navegador contra el mismo código que irá a producción:
#   npm run probar:worker            # en una terminal (déjala abierta)
#   npm run test:e2e                 # en otra
# Para la cola en local necesita QUEUE_MODE=queue; se cambia en .dev.vars y se restaura al salir.
set -euo pipefail
cd "$(dirname "$0")/.."
cp .dev.vars .dev.vars.bak
trap 'mv -f .dev.vars.bak .dev.vars' EXIT
sed -i 's/^QUEUE_MODE=.*/QUEUE_MODE=queue/' .dev.vars
grep -q '^QUEUE_MODE=' .dev.vars || echo 'QUEUE_MODE=queue' >> .dev.vars
npx opennextjs-cloudflare build
npx wrangler dev --port 3000 --test-scheduled
