#!/usr/bin/env bash
# Bangun binary sidecar (backend FastAPI + web/dist yang sudah di-build)
# lewat PyInstaller, lalu taruh hasilnya di src-tauri/binaries dengan nama
# yang sesuai konvensi penamaan sidecar Tauri (akhiran target-triple).
#
# Portabilitas Windows: separator --add-data PyInstaller beda di Windows
# (";" bukan ":"). Skrip ini dipakai bareng lewat Git Bash di CI
# windows-latest, jadi separatornya dideteksi dari $OSTYPE.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f web/dist/index.html ]; then
  echo "-> Membangun frontend (sekali saja)..."
  ( cd web && npm install --include=dev --no-audit --no-fund && npm run build )
fi

if [ ! -d web/node_modules/typescript ]; then
  echo "-> Melengkapi devDependencies frontend..."
  ( cd web && npm install --include=dev --no-audit --no-fund )
fi

if ! python3 -m PyInstaller --version >/dev/null 2>&1; then
  echo "-> Memasang PyInstaller..."
  python3 -m pip install -r requirements-build.txt
fi

case "${OSTYPE:-}" in
  msys*|cygwin*|win32*) ADD_DATA_SEP=";" ;;
  *) ADD_DATA_SEP=":" ;;
esac

echo "-> Menjalankan PyInstaller..."
rm -rf build dist buku-pajak-server.spec
# --strip buang debug symbol. UPX SENGAJA tidak dipakai: PyInstaller
# menonaktifkannya sendiri secara default di platform non-Windows karena
# riwayat masalah kompatibilitas (bisa bikin binary hasil kompres crash) —
# ini keputusan dari PyInstaller, bukan keterbatasan environment build ini.
#
# --exclude-module numpy dan PIL: environment Python di mesin ini penuh
# package data-science/ML yang tidak ada hubungannya dengan aplikasi ini
# (numpy, Pillow, pandas, dst. — lihat `pip show numpy` -> Required-by).
# PyInstaller ikut membundel numpy (termasuk OpenBLAS ~34MB) dan Pillow
# (~9MB) walau app/ tidak pernah import keduanya (sudah dicek via grep) dan
# keduanya tidak ada di requirements.txt — exclude ini aman dan signifikan.
# Sisanya modul stdlib yang jelas tidak dipakai server web ini (bukan GUI,
# bukan test runner, bukan tool build paket).
python3 -m PyInstaller \
  --onefile \
  --strip \
  --name buku-pajak-server \
  --add-data "web/dist${ADD_DATA_SEP}web/dist" \
  --exclude-module numpy \
  --exclude-module PIL \
  --exclude-module tkinter \
  --exclude-module unittest \
  --exclude-module test \
  --exclude-module lib2to3 \
  --exclude-module pydoc_data \
  --exclude-module distutils \
  app/sidecar_entry.py

TARGET_TRIPLE="$(rustc --print host-tuple)"
mkdir -p src-tauri/binaries

BIN_SRC="dist/buku-pajak-server"
BIN_DST="src-tauri/binaries/buku-pajak-server-${TARGET_TRIPLE}"
if [ -f "dist/buku-pajak-server.exe" ]; then
  BIN_SRC="dist/buku-pajak-server.exe"
  BIN_DST="${BIN_DST}.exe"
fi

cp "$BIN_SRC" "$BIN_DST"
chmod +x "$BIN_DST" 2>/dev/null || true
rm -rf build dist buku-pajak-server.spec

echo "-> Sidecar siap: ${BIN_DST}"
