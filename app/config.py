"""Konfigurasi lokasi data, dipakai bareng oleh app web dan API."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# PAJAK_DB selalu di-set eksplisit oleh pemanggil (sidecar Tauri, atau tes)
# saat dijalankan sebagai build PyInstaller; fallback ini cuma dipakai mode
# dev biasa (python -m uvicorn), jadi tidak perlu frozen-aware.
DB_PATH = Path(os.environ.get("PAJAK_DB", BASE_DIR.parent / "data" / "pajak.db"))

if getattr(sys, "frozen", False):
    # Build PyInstaller (--onefile): modul diekstrak ke folder sementara
    # sys._MEIPASS saat proses jalan, dan --add-data "web/dist:web/dist"
    # naruh asetnya persis di path relatif itu, di root folder tersebut —
    # bukan lagi bertetangga dengan app/ seperti di tata letak sumber.
    WEB_DIST = Path(sys._MEIPASS) / "web" / "dist"  # type: ignore[attr-defined]
else:
    # hasil build SPA (vite build) yang disajikan FastAPI
    WEB_DIST = BASE_DIR.parent / "web" / "dist"
