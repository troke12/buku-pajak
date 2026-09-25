"""UI lama: server-rendered Jinja2 (digantikan SPA React + shadcn/ui).

Modul ini TIDAK dipasang lagi di aplikasi utama. Isinya disimpan utuh supaya
tidak ada yang hilang: masih diuji lewat tests/test_app.py, dan bisa dihapus
kapan saja bersama app/templates/ dan app/static/.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, urlencode

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import db, kurs
from .config import DB_PATH
from .tax import STATUS_SAH, ringkasan_tahunan
from .util import angka, ke_angka, persen, rp, rupiah

BASE_DIR = Path(__file__).resolve().parent

BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
JENIS_SETORAN = [
    "PPh Pasal 25",
    "PPh Pasal 29",
    "PPh Pasal 21 (dipotong klien)",
    "PPh Pasal 22",
    "PPh Pasal 23",
    "PPh Pasal 24 (kredit luar negeri)",
    "STP / sanksi",
    "Lainnya",
]
MATA_UANG = ["USD", "SGD", "EUR", "AUD", "GBP", "JPY", "USDT", "USDC", "IDR", "Lainnya"]

app = FastAPI(title="Buku Pajak (UI lama)")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="legacy-static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
templates.env.filters.update({"rp": rp, "rupiah": rupiah, "angka": angka, "persen": persen})

# nama eksplisit untuk pemakaian dari luar modul
legacy_app = app


# ------------------------------------------------------------------ bantuan


def ambil_koneksi():
    conn = db.buka_db(DB_PATH)
    db.init_db(conn)
    return conn


async def baca_form(request: Request) -> dict:
    """Baca body application/x-www-form-urlencoded tanpa dependensi tambahan."""
    body = (await request.body()).decode("utf-8")
    return {k: v[0] for k, v in parse_qs(body, keep_blank_values=True).items()}


def alihkan(path: str, pesan: str | None = None, tipe: str = "ok") -> RedirectResponse:
    if pesan:
        path = f"{path}{'&' if '?' in path else '?'}{urlencode({'pesan': pesan, 'tipe': tipe})}"
    return RedirectResponse(path, status_code=303)


def tahun_aktif(conn, diminta: str | None) -> str:
    tersedia = db.daftar_tahun(conn)
    if diminta:
        return str(diminta)
    kini = str(datetime.now().year)
    if kini in tersedia:
        return kini
    return tersedia[0] if tersedia else kini


def opsi_tahun(conn, tahun: str) -> list[str]:
    kini = str(datetime.now().year)
    tahun_set = set(db.daftar_tahun(conn))
    tahun_set |= {kini, str(int(kini) - 1), str(int(kini) + 1), str(tahun)}
    return sorted(tahun_set, reverse=True)


def hitung_ringkasan(conn, tahun: str):
    p = db.ambil_pengaturan(conn)
    return ringkasan_tahunan(
        bruto=db.total_bruto(conn, tahun),
        status=p["status_ptkp"],
        mode=p["mode_hitung"],
        norma_persen=ke_angka(p["norma_persen"]) or Decimal(50),
        biaya=db.ambil_biaya(conn, tahun),
        kredit=db.total_setoran(conn, tahun),
    )


def daftar_selisih_kurs(conn, tahun: str, ambang: Decimal) -> list[dict]:
    """Bandingkan IDR masuk rekening vs IDR hasil kurs KMK (deteksi selisih)."""
    hasil = []
    for baris in db.daftar_pendapatan(conn, tahun):
        valas = baris.get("jumlah_valas")
        kurs_kmk = baris.get("kurs_kmk")
        if not valas or not kurs_kmk:
            continue
        idr_kmk = Decimal(str(valas)) * Decimal(str(kurs_kmk))
        if idr_kmk <= 0:
            continue
        selisih = Decimal(baris["idr"]) - idr_kmk
        persen_selisih = selisih / idr_kmk * 100
        item = dict(baris)
        item["idr_kmk"] = int(idr_kmk)
        item["selisih"] = int(selisih)
        item["selisih_persen"] = persen_selisih
        item["waspada"] = abs(persen_selisih) >= ambang
        hasil.append(item)
    return hasil


def konteks(request: Request, conn, tahun: str, hal: str) -> dict:
    p = db.ambil_pengaturan(conn)
    return {
        "request": request,
        "hal": hal,
        "tahun": tahun,
        "tahun_opsi": opsi_tahun(conn, tahun),
        "pengaturan": p,
        "STATUS_SAH": STATUS_SAH,
        "JENIS_SETORAN": JENIS_SETORAN,
        "MATA_UANG": MATA_UANG,
        "BULAN": BULAN,
        "pesan": request.query_params.get("pesan"),
        "tipe": request.query_params.get("tipe", "ok"),
    }


# ------------------------------------------------------------------- halaman


@app.get("/")
def halaman_ringkasan(request: Request, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "ringkasan")
        ringkas = hitung_ringkasan(conn, tahun)
        per_bulan = db.bruto_per_bulan(conn, tahun)
        maks_bulan = max(per_bulan) if any(per_bulan) else 0

        ks.update(
            {
                "ringkas": ringkas,
                "per_bulan": list(zip(BULAN, per_bulan)),
                "maks_bulan": maks_bulan,
                "per_sumber": db.bruto_per_sumber(conn, tahun),
                "setoran_jenis": db.setoran_per_jenis(conn, tahun),
                "setoran_jumlah": len(db.daftar_setoran(conn, tahun)),
            }
        )
        return templates.TemplateResponse(request, "ringkasan.html", ks)
    finally:
        conn.close()


@app.get("/pendapatan")
def halaman_pendapatan(request: Request, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "pendapatan")
        ks["daftar"] = db.daftar_pendapatan(conn, tahun)
        ks["total"] = db.total_bruto(conn, tahun)
        return templates.TemplateResponse(request, "pendapatan.html", ks)
    finally:
        conn.close()


@app.get("/pendapatan/baru")
def form_pendapatan_baru(request: Request, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "pendapatan")
        ks["nilai"] = {"tanggal": date.today().isoformat(), "bank": ks["pengaturan"]["bank_default"]}
        ks["galat"] = None
        ks["mode_form"] = "baru"
        return templates.TemplateResponse(request, "pendapatan_form.html", ks)
    finally:
        conn.close()


@app.get("/pendapatan/{id_}/ubah")
def form_pendapatan_ubah(request: Request, id_: int, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        data = db.ambil_pendapatan(conn, id_)
        if not data:
            return alihkan("/pendapatan", "Data pendapatan tidak ditemukan.", "err")
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "pendapatan")
        ks["nilai"] = data
        ks["galat"] = None
        ks["mode_form"] = "ubah"
        return templates.TemplateResponse(request, "pendapatan_form.html", ks)
    finally:
        conn.close()


def _validasi_pendapatan(form: dict) -> tuple[dict, str | None]:
    tanggal = (form.get("tanggal") or "").strip()
    sumber = (form.get("sumber") or "").strip()
    idr = ke_angka(form.get("idr"))
    valas = ke_angka(form.get("jumlah_valas")) if (form.get("jumlah_valas") or "").strip() else None
    kurs_kmk = ke_angka(form.get("kurs_kmk")) if (form.get("kurs_kmk") or "").strip() else None

    if not tanggal:
        return {}, "Tanggal wajib diisi."
    try:
        datetime.strptime(tanggal, "%Y-%m-%d")
    except ValueError:
        return {}, "Format tanggal harus YYYY-MM-DD."
    if not sumber:
        return {}, "Sumber / klien wajib diisi."
    if idr <= 0:
        return {}, "Jumlah IDR yang masuk rekening harus lebih dari 0."

    return (
        {
            "tanggal": tanggal,
            "sumber": sumber,
            "mata_uang": (form.get("mata_uang") or "USD").strip(),
            "jumlah_valas": float(valas) if valas else None,
            "idr": int(idr),
            "bank": (form.get("bank") or "").strip(),
            "kurs_kmk": float(kurs_kmk) if kurs_kmk else None,
            "catatan": (form.get("catatan") or "").strip(),
        },
        None,
    )


@app.post("/pendapatan")
async def simpan_pendapatan_baru(request: Request):
    conn = ambil_koneksi()
    try:
        form = await baca_form(request)
        data, galat = _validasi_pendapatan(form)
        if galat:
            tahun = tahun_aktif(conn, form.get("tahun"))
            ks = konteks(request, conn, tahun, "pendapatan")
            ks.update({"nilai": form, "galat": galat, "mode_form": "baru"})
            return templates.TemplateResponse(request, "pendapatan_form.html", ks)

        if data["kurs_kmk"] is None and data["jumlah_valas"] and data["mata_uang"] != "IDR":
            try:
                kmk = kurs.ambil_kurs(data["tanggal"], data["mata_uang"])
                data["kurs_kmk"] = kmk["nilai"]
            except kurs.KursError:
                pass

        db.tambah_pendapatan(conn, data)
        return alihkan(f"/pendapatan?tahun={data['tanggal'][:4]}", "Pendapatan tersimpan.")
    finally:
        conn.close()


@app.post("/pendapatan/{id_}/ubah")
async def simpan_pendapatan_ubah(request: Request, id_: int):
    conn = ambil_koneksi()
    try:
        form = await baca_form(request)
        data, galat = _validasi_pendapatan(form)
        if galat:
            tahun = tahun_aktif(conn, form.get("tahun"))
            ks = konteks(request, conn, tahun, "pendapatan")
            data = dict(form)
            data["id"] = id_
            ks.update({"nilai": data, "galat": galat, "mode_form": "ubah"})
            return templates.TemplateResponse(request, "pendapatan_form.html", ks)

        db.ubah_pendapatan(conn, id_, data)
        return alihkan(f"/pendapatan?tahun={data['tanggal'][:4]}", "Perubahan tersimpan.")
    finally:
        conn.close()


@app.post("/pendapatan/{id_}/hapus")
def hapus_pendapatan(request: Request, id_: int, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        db.hapus_pendapatan(conn, id_)
        return alihkan(f"/pendapatan?tahun={tahun}" if tahun else "/pendapatan", "Pendapatan dihapus.")
    finally:
        conn.close()


@app.get("/setoran")
def halaman_setoran(request: Request, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "setoran")
        ks["daftar"] = db.daftar_setoran(conn, tahun)
        ks["total"] = db.total_setoran(conn, tahun)
        ks["target"] = hitung_ringkasan(conn, tahun).pph
        return templates.TemplateResponse(request, "setoran.html", ks)
    finally:
        conn.close()


@app.get("/setoran/baru")
def form_setoran_baru(request: Request, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "setoran")
        ks["nilai"] = {"tanggal": date.today().isoformat(), "jenis": "PPh Pasal 25", "masa": f"{tahun}-01"}
        ks["galat"] = None
        return templates.TemplateResponse(request, "setoran_form.html", ks)
    finally:
        conn.close()


@app.post("/setoran")
async def simpan_setoran(request: Request):
    conn = ambil_koneksi()
    try:
        form = await baca_form(request)
        tanggal = (form.get("tanggal") or "").strip()
        jenis = (form.get("jenis") or "").strip()
        jumlah = ke_angka(form.get("jumlah"))

        galat = None
        if not tanggal:
            galat = "Tanggal wajib diisi."
        else:
            try:
                datetime.strptime(tanggal, "%Y-%m-%d")
            except ValueError:
                galat = "Format tanggal harus YYYY-MM-DD."
        if not galat and not jenis:
            galat = "Jenis setoran wajib dipilih."
        if not galat and jumlah <= 0:
            galat = "Jumlah setoran harus lebih dari 0."

        if galat:
            tahun = tahun_aktif(conn, form.get("tahun"))
            ks = konteks(request, conn, tahun, "setoran")
            ks.update({"nilai": form, "galat": galat})
            return templates.TemplateResponse(request, "setoran_form.html", ks)

        db.tambah_setoran(
            conn,
            {
                "tanggal": tanggal,
                "jenis": jenis,
                "masa": (form.get("masa") or "").strip(),
                "jumlah": int(jumlah),
                "catatan": (form.get("catatan") or "").strip(),
            },
        )
        return alihkan(f"/setoran?tahun={tanggal[:4]}", "Setoran tersimpan.")
    finally:
        conn.close()


@app.post("/setoran/{id_}/hapus")
def hapus_setoran(request: Request, id_: int, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        db.hapus_setoran(conn, id_)
        return alihkan(f"/setoran?tahun={tahun}" if tahun else "/setoran", "Setoran dihapus.")
    finally:
        conn.close()


@app.get("/spt")
def halaman_spt(request: Request, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "spt")
        ks["ringkas"] = hitung_ringkasan(conn, tahun)
        ks["setoran_jenis"] = db.setoran_per_jenis(conn, tahun)
        ks["biaya"] = db.ambil_biaya(conn, tahun)
        luar_negeri = sum(
            int(r["idr"]) for r in db.daftar_pendapatan(conn, tahun)
            if (r.get("mata_uang") or "").upper() not in {"IDR", ""}
        )
        ks["penghasilan_luar_negeri"] = luar_negeri
        return templates.TemplateResponse(request, "spt.html", ks)
    finally:
        conn.close()


@app.post("/spt/biaya")
async def simpan_biaya(request: Request):
    conn = ambil_koneksi()
    try:
        form = await baca_form(request)
        tahun = (form.get("tahun") or str(datetime.now().year)).strip()
        db.simpan_biaya(conn, tahun, int(ke_angka(form.get("biaya"))), (form.get("catatan") or "").strip())
        return alihkan(f"/spt?tahun={tahun}", "Biaya usaha tersimpan.")
    finally:
        conn.close()


@app.get("/pengaturan")
def halaman_pengaturan(request: Request, tahun: str | None = None):
    conn = ambil_koneksi()
    try:
        tahun = tahun_aktif(conn, tahun)
        ks = konteks(request, conn, tahun, "pengaturan")
        return templates.TemplateResponse(request, "pengaturan.html", ks)
    finally:
        conn.close()


@app.post("/pengaturan")
async def simpan_pengaturan(request: Request):
    conn = ambil_koneksi()
    try:
        form = await baca_form(request)
        status = (form.get("status_ptkp") or "TK/0").strip()
        mode = (form.get("mode_hitung") or "norma").strip()
        norma = ke_angka(form.get("norma_persen"))

        galat = None
        if status not in STATUS_SAH:
            galat = "Status PTKP tidak dikenal."
        elif mode not in {"norma", "pembukuan"}:
            galat = "Mode hitung harus 'norma' atau 'pembukuan'."
        elif mode == "norma" and not (0 < norma <= 100):
            galat = "Persentase norma harus di antara 0 dan 100."

        if galat:
            return alihkan("/pengaturan", galat, "err")

        db.simpan_pengaturan(
            conn,
            {
                "nama": (form.get("nama") or "").strip(),
                "npwp": (form.get("npwp") or "").strip(),
                "status_ptkp": status,
                "mode_hitung": mode,
                "norma_persen": str(norma),
                "bank_default": (form.get("bank_default") or "").strip(),
                "ambang_selisih": str(ke_angka(form.get("ambang_selisih")) or Decimal(2)),
            },
        )
        return alihkan("/pengaturan", "Pengaturan tersimpan.")
    finally:
        conn.close()


# ----------------------------------------------------------------------- API


@app.get("/api/kurs")
def api_kurs(tanggal: str | None = None, currency: str = "USD"):
    try:
        return {"ok": True, **kurs.ambil_kurs(tanggal, currency)}
    except kurs.KursError as exc:
        return {"ok": False, "pesan": str(exc)}
