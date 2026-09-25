"""Ambil Kurs Pajak (KMK) resmi dari Kemenkeu.

CATATAN: tidak dipakai lagi oleh aplikasi. Basis hitung sekarang murni rupiah yang
masuk rekening, jadi konversi valas sudah dihapus dari model data, API, dan UI.
Modul ini disimpan (beserta tests/test_kurs.py) supaya tidak ada yang hilang —
hapus saja kalau memang tidak diperlukan.

Halaman publik fiskal.kemenkeu.go.id merender tabel kurs mingguan (server-side),
jadi bisa diambil langsung. Kurs KMK berlaku Rabu-Selasa dan di-update tiap Rabu.
"""

from __future__ import annotations

import re
import urllib.error
import urllib.request

BASE_URL = "https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

_POLA_KURS = re.compile(
    r"\(([A-Z]{3})\)</span>.*?<div class=\"m-l-5\">([\d.,]+)</div>",
    re.S,
)


class KursError(Exception):
    """Gagal mengambil / membaca kurs pajak."""


def _ke_float(teks: str) -> float:
    """'17.707,00' -> 17707.00"""
    return float(teks.replace(".", "").replace(",", "."))


def parse_kurs(html: str, currency: str = "USD") -> dict:
    """Ekstrak nomor KMK, periode, dan nilai kurs dari HTML halaman Kurs Pajak."""
    currency = currency.upper()

    nomor = periode = None
    m = re.search(r"KMK Nomor\s*([^<]+)", html)
    if m:
        nomor = m.group(1).strip()
    p = re.search(r"Tanggal berlaku:\s*([^<]+)", html)
    if p:
        periode = p.group(1).strip()

    rates: dict[str, float] = {}
    for kode, nilai in _POLA_KURS.findall(html):
        try:
            rates[kode] = _ke_float(nilai)
        except ValueError:
            continue

    if not rates:
        raise KursError("Tabel kurs tidak ditemukan pada halaman Kemenkeu.")
    if currency not in rates:
        raise KursError(f"Kurs {currency} tidak tersedia pada periode ini.")

    return {
        "currency": currency,
        "nilai": rates[currency],
        "nomor": nomor,
        "periode": periode,
        "semua": rates,
    }


def ambil_kurs(tanggal: str | None = None, currency: str = "USD", timeout: int = 25) -> dict:
    """Ambil kurs KMK untuk tanggal tertentu (format YYYY-MM-DD). None = periode terakhir."""
    url = BASE_URL + (f"?date={tanggal}" if tanggal else "")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            html = resp.read().decode("utf-8", "ignore")
    except urllib.error.URLError as exc:
        raise KursError(f"Tidak bisa menghubungi Kemenkeu: {exc}") from exc
    return parse_kurs(html, currency)
