"""Entrypoint untuk build PyInstaller (sidecar Tauri).

Titik masuk terpisah dari app/main.py karena PyInstaller butuh skrip yang
benar-benar dieksekusi (bukan diimpor lewat `uvicorn app.main:app` seperti
run.sh), dan supaya jalur dev (run.sh) tidak perlu tahu apa-apa soal
packaging. Tauri men-spawn binary hasil build ini sebagai sidecar dan
men-set PAJAK_DB/PORT lewat environment variable.
"""

from __future__ import annotations

import os

import uvicorn

from app.main import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8743")))
