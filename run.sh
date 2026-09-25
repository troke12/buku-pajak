#!/usr/bin/env bash
# Buku Pajak — satu perintah untuk menjalankan semuanya sebagai satu proses.
#   ./run.sh            -> build frontend bila belum ada, lalu jalankan di :8000
#   PORT=9000 ./run.sh  -> ganti port
#   ./run.sh --reload   -> mode pengembangan (auto-reload)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f web/dist/index.html ]; then
  echo "-> Membangun frontend (sekali saja)..."
  ( cd web && npm install --include=dev --no-audit --no-fund && npm run build )
fi

# NODE_ENV=production bikin npm melewati devDependencies, jadi pastikan
# typescript & kawan-kawan ada sebelum build.
if [ ! -d web/node_modules/typescript ]; then
  echo "-> Melengkapi devDependencies frontend..."
  ( cd web && npm install --include=dev --no-audit --no-fund )
fi

echo "-> Jalan di http://127.0.0.1:${PORT:-8000}"
exec python3 -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}" "$@"
