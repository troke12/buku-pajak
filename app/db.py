"""Lapisan database SQLite: pendapatan, setoran pajak, biaya, dan pengaturan."""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

SKEMA = """
CREATE TABLE IF NOT EXISTS pendapatan (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT    NOT NULL,
    sumber  TEXT    NOT NULL,
    idr     INTEGER NOT NULL,
    bank    TEXT,
    catatan TEXT,
    dibuat  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS setoran (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT    NOT NULL,
    jenis   TEXT    NOT NULL,
    masa    TEXT,
    jumlah  INTEGER NOT NULL,
    catatan TEXT,
    dibuat  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS biaya (
    tahun   TEXT PRIMARY KEY,
    jumlah  INTEGER NOT NULL,
    catatan TEXT
);

CREATE TABLE IF NOT EXISTS pengaturan (
    kunci TEXT PRIMARY KEY,
    nilai TEXT
);

CREATE INDEX IF NOT EXISTS idx_pendapatan_tanggal ON pendapatan(tanggal);
CREATE INDEX IF NOT EXISTS idx_setoran_tanggal    ON setoran(tanggal);
"""

PENGATURAN_DEFAULT = {
    "nama": "",
    "npwp": "",
    "status_ptkp": "TK/0",
    "mode_hitung": "norma",
    "norma_persen": "50",
    "bank_default": "BCA",
}

# Kolom peninggalan era konversi valas. Basis hitung selalu IDR yang masuk
# rekening, jadi kolom mata uang/valas/kurs dibuang saat database dibuka.
KOLOM_USANG = ("mata_uang", "jumlah_valas", "kurs_kmk", "ambang_selisih")


def buka_db(path: str | Path) -> sqlite3.Connection:
    """Buka (dan siapkan) koneksi SQLite.

    check_same_thread=False karena FastAPI menjalankan dependency dan endpoint di
    thread pool: satu koneksi per request boleh dipakai lintas thread, dan koneksi
    ini tidak pernah dibagi ke request lain.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SKEMA)
    _buang_kolom_usang(conn)
    conn.commit()


def _buang_kolom_usang(conn: sqlite3.Connection) -> None:
    """Buang kolom lama kalau database dibuat sebelum konsep valas dihapus."""
    kolom = {baris["name"] for baris in conn.execute("PRAGMA table_info(pendapatan)")}
    for nama in KOLOM_USANG:
        if nama == "ambang_selisih":
            conn.execute("DELETE FROM pengaturan WHERE kunci = 'ambang_selisih'")
        elif nama in kolom:
            conn.execute(f"ALTER TABLE pendapatan DROP COLUMN {nama}")


def _sekarang() -> str:
    return datetime.now().isoformat(timespec="seconds")


# ---------------------------------------------------------------- pengaturan


def ambil_pengaturan(conn: sqlite3.Connection) -> dict:
    hasil = dict(PENGATURAN_DEFAULT)
    for baris in conn.execute("SELECT kunci, nilai FROM pengaturan"):
        hasil[baris["kunci"]] = baris["nilai"]
    return hasil


def simpan_pengaturan(conn: sqlite3.Connection, data: dict) -> None:
    for kunci, nilai in data.items():
        conn.execute(
            "INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) "
            "ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai",
            (kunci, "" if nilai is None else str(nilai)),
        )
    conn.commit()


# ---------------------------------------------------------------- pendapatan


def tambah_pendapatan(conn: sqlite3.Connection, data: dict) -> int:
    cur = conn.execute(
        """INSERT INTO pendapatan (tanggal, sumber, idr, bank, catatan, dibuat)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            data["tanggal"],
            data["sumber"],
            int(data["idr"]),
            data.get("bank") or None,
            data.get("catatan") or None,
            _sekarang(),
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def ubah_pendapatan(conn: sqlite3.Connection, id_: int, data: dict) -> None:
    conn.execute(
        """UPDATE pendapatan
           SET tanggal = ?, sumber = ?, idr = ?, bank = ?, catatan = ?
           WHERE id = ?""",
        (
            data["tanggal"],
            data["sumber"],
            int(data["idr"]),
            data.get("bank") or None,
            data.get("catatan") or None,
            id_,
        ),
    )
    conn.commit()


def hapus_pendapatan(conn: sqlite3.Connection, id_: int) -> None:
    conn.execute("DELETE FROM pendapatan WHERE id = ?", (id_,))
    conn.commit()


def ambil_pendapatan(conn: sqlite3.Connection, id_: int) -> dict | None:
    baris = conn.execute("SELECT * FROM pendapatan WHERE id = ?", (id_,)).fetchone()
    return dict(baris) if baris else None


def daftar_pendapatan(conn: sqlite3.Connection, tahun: str | None = None) -> list[dict]:
    if tahun:
        sql = "SELECT * FROM pendapatan WHERE substr(tanggal,1,4) = ? ORDER BY tanggal DESC, id DESC"
        param = (str(tahun),)
    else:
        sql = "SELECT * FROM pendapatan ORDER BY tanggal DESC, id DESC"
        param = ()
    return [dict(r) for r in conn.execute(sql, param)]


def total_bruto(conn: sqlite3.Connection, tahun: str) -> int:
    baris = conn.execute(
        "SELECT COALESCE(SUM(idr), 0) AS total FROM pendapatan WHERE substr(tanggal,1,4) = ?",
        (str(tahun),),
    ).fetchone()
    return int(baris["total"])


def bruto_per_bulan(conn: sqlite3.Connection, tahun: str) -> list[int]:
    """Total IDR per bulan (Jan-Des) pada tahun tertentu."""
    hasil = [0] * 12
    for baris in conn.execute(
        """SELECT CAST(substr(tanggal,6,2) AS INTEGER) AS bulan, COALESCE(SUM(idr),0) AS total
           FROM pendapatan WHERE substr(tanggal,1,4) = ?
           GROUP BY bulan""",
        (str(tahun),),
    ):
        bulan = int(baris["bulan"])
        if 1 <= bulan <= 12:
            hasil[bulan - 1] = int(baris["total"])
    return hasil


def bruto_per_sumber(conn: sqlite3.Connection, tahun: str) -> list[dict]:
    return [
        {"sumber": r["sumber"], "total": int(r["total"]), "jumlah_transaksi": int(r["n"])}
        for r in conn.execute(
            """SELECT sumber, COALESCE(SUM(idr),0) AS total, COUNT(*) AS n
               FROM pendapatan WHERE substr(tanggal,1,4) = ?
               GROUP BY sumber ORDER BY total DESC""",
            (str(tahun),),
        )
    ]


def bruto_per_bank(conn: sqlite3.Connection, tahun: str) -> list[dict]:
    return [
        {
            "bank": r["bank"] or "Tanpa keterangan",
            "total": int(r["total"]),
            "jumlah_transaksi": int(r["n"]),
        }
        for r in conn.execute(
            """SELECT bank, COALESCE(SUM(idr),0) AS total, COUNT(*) AS n
               FROM pendapatan WHERE substr(tanggal,1,4) = ?
               GROUP BY bank ORDER BY total DESC""",
            (str(tahun),),
        )
    ]


def daftar_tahun(conn: sqlite3.Connection) -> list[str]:
    tahun = {str(r["tahun"]) for r in conn.execute(
        "SELECT DISTINCT substr(tanggal,1,4) AS tahun FROM pendapatan WHERE tanggal <> ''"
    )}
    tahun |= {str(r["tahun"]) for r in conn.execute(
        "SELECT DISTINCT substr(tanggal,1,4) AS tahun FROM setoran WHERE tanggal <> ''"
    )}
    tahun |= {str(r["tahun"]) for r in conn.execute("SELECT tahun FROM biaya")}
    tahun.discard("")
    return sorted(tahun, reverse=True)


# ------------------------------------------------------------------- setoran


def tambah_setoran(conn: sqlite3.Connection, data: dict) -> int:
    cur = conn.execute(
        """INSERT INTO setoran (tanggal, jenis, masa, jumlah, catatan, dibuat)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            data["tanggal"],
            data["jenis"],
            data.get("masa") or None,
            int(data["jumlah"]),
            data.get("catatan") or None,
            _sekarang(),
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def hapus_setoran(conn: sqlite3.Connection, id_: int) -> None:
    conn.execute("DELETE FROM setoran WHERE id = ?", (id_,))
    conn.commit()


def daftar_setoran(conn: sqlite3.Connection, tahun: str | None = None) -> list[dict]:
    if tahun:
        sql = "SELECT * FROM setoran WHERE substr(tanggal,1,4) = ? ORDER BY tanggal DESC, id DESC"
        param = (str(tahun),)
    else:
        sql = "SELECT * FROM setoran ORDER BY tanggal DESC, id DESC"
        param = ()
    return [dict(r) for r in conn.execute(sql, param)]


def total_setoran(conn: sqlite3.Connection, tahun: str) -> int:
    baris = conn.execute(
        "SELECT COALESCE(SUM(jumlah),0) AS total FROM setoran WHERE substr(tanggal,1,4) = ?",
        (str(tahun),),
    ).fetchone()
    return int(baris["total"])


def setoran_per_jenis(conn: sqlite3.Connection, tahun: str) -> list[dict]:
    return [
        {"jenis": r["jenis"], "total": int(r["total"])}
        for r in conn.execute(
            """SELECT jenis, COALESCE(SUM(jumlah),0) AS total FROM setoran
               WHERE substr(tanggal,1,4) = ? GROUP BY jenis ORDER BY total DESC""",
            (str(tahun),),
        )
    ]


# --------------------------------------------------------------------- biaya


def ambil_biaya(conn: sqlite3.Connection, tahun: str) -> int:
    baris = conn.execute("SELECT jumlah FROM biaya WHERE tahun = ?", (str(tahun),)).fetchone()
    return int(baris["jumlah"]) if baris else 0


def simpan_biaya(conn: sqlite3.Connection, tahun: str, jumlah: int, catatan: str = "") -> None:
    conn.execute(
        """INSERT INTO biaya (tahun, jumlah, catatan) VALUES (?, ?, ?)
           ON CONFLICT(tahun) DO UPDATE SET jumlah = excluded.jumlah, catatan = excluded.catatan""",
        (str(tahun), int(jumlah), catatan or None),
    )
    conn.commit()
