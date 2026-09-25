"""API JSON untuk frontend (React + shadcn/ui).

Semua aturan pajak tetap di app/tax.py dan akses data tetap di app/db.py;
modul ini hanya lapisan HTTP + validasi skema.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from . import db
from .config import DB_PATH
from .tax import STATUS_SAH, ringkasan_tahunan
from .util import ke_angka

router = APIRouter(prefix="/api", tags=["pajak"])

TAHUN_KINI = str(datetime.now().year)


def koneksi():
    conn = db.buka_db(DB_PATH)
    db.init_db(conn)
    try:
        yield conn
    finally:
        conn.close()


# ------------------------------------------------------------------ skema


class PendapatanMasuk(BaseModel):
    tanggal: date
    sumber: Annotated[str, Field(min_length=1, max_length=200)]
    idr: int = Field(gt=0, description="Rupiah yang benar-benar masuk rekening")
    bank: str | None = Field(default=None, max_length=80)
    catatan: str | None = Field(default=None, max_length=500)

    @field_validator("sumber")
    @classmethod
    def wajib_isi(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Tidak boleh kosong")
        return v

    @field_validator("bank", "catatan")
    @classmethod
    def rapikan_opsional(cls, v):
        if isinstance(v, str):
            v = v.strip()
        return v or None


class Pendapatan(PendapatanMasuk):
    id: int
    tanggal: str  # type: ignore[assignment]
    dibuat: str | None = None


class SetoranMasuk(BaseModel):
    tanggal: date
    jenis: Annotated[str, Field(min_length=1, max_length=120)]
    masa: str | None = Field(default=None, max_length=20)
    jumlah: int = Field(gt=0)
    catatan: str | None = Field(default=None, max_length=500)


class Setoran(SetoranMasuk):
    id: int
    tanggal: str  # type: ignore[assignment]
    dibuat: str | None = None


class Pengaturan(BaseModel):
    nama: str = ""
    npwp: str = ""
    status_ptkp: str = "TK/0"
    mode_hitung: Literal["norma", "pembukuan"] = "norma"
    norma_persen: float = Field(default=50, gt=0, le=100)
    bank_default: str = "BCA"

    @field_validator("status_ptkp")
    @classmethod
    def status_sah(cls, v: str) -> str:
        if v not in STATUS_SAH:
            raise ValueError(f"Status PTKP tidak dikenal: {v}")
        return v


class BiayaMasuk(BaseModel):
    tahun: str
    jumlah: int = Field(ge=0)
    catatan: str = ""


# ------------------------------------------------------- pengaturan & tahun


@router.get("/sehat")
def sehat():
    return {"ok": True, "aplikasi": "buku-pajak", "versi": "0.2.0"}


@router.get("/tahun", response_model=list[str])
def daftar_tahun(conn=Depends(koneksi)):
    tersedia = db.daftar_tahun(conn)
    kini = int(TAHUN_KINI)
    gabung = sorted({*tersedia, str(kini), str(kini - 1), str(kini + 1)}, reverse=True)
    return gabung


@router.get("/pengaturan", response_model=Pengaturan)
def ambil_pengaturan(conn=Depends(koneksi)):
    p = db.ambil_pengaturan(conn)
    return Pengaturan(
        nama=p["nama"],
        npwp=p["npwp"],
        status_ptkp=p["status_ptkp"],
        mode_hitung=p["mode_hitung"],
        norma_persen=float(ke_angka(p["norma_persen"])),
        bank_default=p["bank_default"],
    )


@router.put("/pengaturan", response_model=Pengaturan)
def simpan_pengaturan(data: Pengaturan, conn=Depends(koneksi)):
    db.simpan_pengaturan(conn, data.model_dump())
    return data


# ------------------------------------------------------------------ biaya


@router.get("/biaya", response_model=BiayaMasuk)
def ambil_biaya(tahun: str = Query(default=TAHUN_KINI), conn=Depends(koneksi)):
    return BiayaMasuk(tahun=tahun, jumlah=db.ambil_biaya(conn, tahun))


@router.put("/biaya", response_model=BiayaMasuk)
def simpan_biaya(data: BiayaMasuk, conn=Depends(koneksi)):
    db.simpan_biaya(conn, data.tahun, data.jumlah, data.catatan)
    return data


# ------------------------------------------------------------- pendapatan


@router.get("/pendapatan", response_model=list[Pendapatan])
def daftar_pendapatan(tahun: str | None = None, conn=Depends(koneksi)):
    return db.daftar_pendapatan(conn, tahun)


@router.post("/pendapatan", response_model=Pendapatan, status_code=201)
def tambah_pendapatan(data: PendapatanMasuk, conn=Depends(koneksi)):
    isi = data.model_dump()
    isi["tanggal"] = data.tanggal.isoformat()
    baru_id = db.tambah_pendapatan(conn, isi)
    return db.ambil_pendapatan(conn, baru_id)


@router.put("/pendapatan/{id_}", response_model=Pendapatan)
def ubah_pendapatan(id_: int, data: PendapatanMasuk, conn=Depends(koneksi)):
    if not db.ambil_pendapatan(conn, id_):
        raise HTTPException(status_code=404, detail="Data pendapatan tidak ditemukan")
    isi = data.model_dump()
    isi["tanggal"] = data.tanggal.isoformat()
    db.ubah_pendapatan(conn, id_, isi)
    return db.ambil_pendapatan(conn, id_)


@router.delete("/pendapatan/{id_}", status_code=204)
def hapus_pendapatan(id_: int, conn=Depends(koneksi)):
    if not db.ambil_pendapatan(conn, id_):
        raise HTTPException(status_code=404, detail="Data pendapatan tidak ditemukan")
    db.hapus_pendapatan(conn, id_)
    return None


# ---------------------------------------------------------------- setoran


@router.get("/setoran", response_model=list[Setoran])
def daftar_setoran(tahun: str | None = None, conn=Depends(koneksi)):
    return db.daftar_setoran(conn, tahun)


@router.post("/setoran", response_model=Setoran, status_code=201)
def tambah_setoran(data: SetoranMasuk, conn=Depends(koneksi)):
    isi = data.model_dump()
    isi["tanggal"] = data.tanggal.isoformat()
    baru_id = db.tambah_setoran(conn, isi)
    baris = conn.execute("SELECT * FROM setoran WHERE id = ?", (baru_id,)).fetchone()
    return dict(baris)


@router.delete("/setoran/{id_}", status_code=204)
def hapus_setoran(id_: int, conn=Depends(koneksi)):
    db.hapus_setoran(conn, id_)
    return None


# --------------------------------------------------------------- ringkasan


def _ringkasan(conn, tahun: str):
    p = db.ambil_pengaturan(conn)
    return ringkasan_tahunan(
        bruto=db.total_bruto(conn, tahun),
        status=p["status_ptkp"],
        mode=p["mode_hitung"],
        norma_persen=ke_angka(p["norma_persen"]) or Decimal(50),
        biaya=db.ambil_biaya(conn, tahun),
        kredit=db.total_setoran(conn, tahun),
    ), p


@router.get("/ringkasan")
def ringkasan(tahun: str = Query(default=TAHUN_KINI), conn=Depends(koneksi)):
    ringkas, _ = _ringkasan(conn, tahun)

    return {
        "tahun": tahun,
        "bruto": int(ringkas.bruto),
        "neto": int(ringkas.neto),
        "ptkp": int(ringkas.ptkp),
        "pkp": int(ringkas.pkp),
        "pph": int(ringkas.pph),
        "kredit": int(ringkas.kredit),
        "kurang_bayar": int(ringkas.kurang_bayar),
        "pph25_bulanan": int(ringkas.pph25_bulanan),
        "status_ptkp": ringkas.status,
        "mode": ringkas.mode,
        "norma_persen": float(ringkas.norma_persen),
        "biaya": int(ringkas.biaya),
        "rincian": [
            {
                "dari": int(r["dari"]),
                "sampai": int(r["sampai"]) if r["sampai"] is not None else None,
                "tarif": float(r["tarif"]),
                "dasar": int(r["dasar"]),
                "pajak": int(r["pajak"]),
            }
            for r in ringkas.rincian
        ],
        "per_bulan": db.bruto_per_bulan(conn, tahun),
        "per_sumber": db.bruto_per_sumber(conn, tahun),
        "per_bank": db.bruto_per_bank(conn, tahun),
        "setoran_jenis": db.setoran_per_jenis(conn, tahun),
        "setoran_jumlah": len(db.daftar_setoran(conn, tahun)),
    }
