"""Buku Pajak — monolith.

Satu proses FastAPI menyajikan dua hal sekaligus:
  /api/*   API JSON
  /*       SPA hasil build (web/dist)

Jadi tidak ada proses kedua, tidak ada CORS, dan cukup satu port. Kalau
frontend belum dibangun, rute akar menjelaskan cara membangunnya.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .api import router as api_router
from .config import WEB_DIST

app = FastAPI(
    title="Buku Pajak",
    description="Pencatatan penghasilan valas & hitung PPh pekerjaan bebas.",
)

app.include_router(api_router)

# /app dulu dipakai saat SPA disajikan terpisah; sekarang cukup arahkan ke akar.
@app.get("/app", include_in_schema=False)
def app_lama() -> RedirectResponse:
    return RedirectResponse("/")


if WEB_DIST.is_dir():
    aset = WEB_DIST / "assets"
    if aset.is_dir():
        app.mount("/assets", StaticFiles(directory=aset), name="assets")

    @app.get("/{jalur:path}", include_in_schema=False)
    def spa(jalur: str = "") -> FileResponse:
        """Sajikan berkas dari dist kalau ada, selain itu index.html.

        Rute ini didaftarkan paling akhir, jadi /api, /assets, /docs, dan
        /openapi.json tetap ditangani rute masing-masing.
        """
        if jalur:
            calon = (WEB_DIST / jalur).resolve()
            # jangan sampai bisa membaca berkas di luar folder dist
            if calon.is_relative_to(WEB_DIST.resolve()) and calon.is_file():
                return FileResponse(calon)
        return FileResponse(WEB_DIST / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def belum_dibangun() -> dict:
        return {
            "pesan": "Frontend belum dibangun.",
            "cara": "cd web && npm install --include=dev && npm run build",
            "dokumentasi_api": "/docs",
        }
