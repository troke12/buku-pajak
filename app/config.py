"""Konfigurasi lokasi data, dipakai bareng oleh app web dan API."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DB_PATH = Path(os.environ.get("PAJAK_DB", BASE_DIR.parent / "data" / "pajak.db"))

# hasil build SPA (vite build) yang disajikan FastAPI
WEB_DIST = BASE_DIR.parent / "web" / "dist"
