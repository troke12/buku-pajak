"""Utilitas parsing & format angka gaya Indonesia."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def ke_angka(teks) -> Decimal:
    """Parse '26.500.000' / '1.500,50' / '1500.5' menjadi Decimal.

    Mendukung format Indonesia (titik = ribuan, koma = desimal) maupun
    format polos. Mengembalikan Decimal(0) bila kosong/tidak valid.
    """
    if teks is None:
        return Decimal(0)
    if isinstance(teks, (int, float, Decimal)):
        return Decimal(str(teks))

    s = str(teks).strip()
    if not s:
        return Decimal(0)
    s = re.sub(r"[^\d.,\-]", "", s)
    if s in {"", "-", ".", ","}:
        return Decimal(0)

    punya_titik = "." in s
    punya_koma = "," in s

    if punya_titik and punya_koma:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif punya_koma:
        s = s.replace(",", ".")
    elif punya_titik:
        # titik sebagai pemisah ribuan ala Indonesia (mis. 26.500.000)
        if re.fullmatch(r"-?\d{1,3}(\.\d{3})+", s):
            s = s.replace(".", "")
        elif s.count(".") > 1:
            s = s.replace(".", "")

    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal(0)


def rupiah(nilai) -> str:
    """1234567 -> '1.234.567'. Nilai kosong jadi '—' supaya template tidak meledak."""
    if nilai is None or nilai == "":
        return "—"
    n = int(Decimal(nilai).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return f"{n:,}".replace(",", ".")


def rp(nilai) -> str:
    return f"Rp {rupiah(nilai)}"


def angka(nilai, desimal: int = 2) -> str:
    """1500.5 -> '1.500,50'"""
    if nilai is None:
        return "-"
    d = Decimal(str(nilai)).quantize(Decimal("1." + "0" * desimal), rounding=ROUND_HALF_UP)
    teks = f"{d:,.{desimal}f}"
    return teks.replace(",", "\u0000").replace(".", ",").replace("\u0000", ".")


def persen(nilai, desimal: int = 2) -> str:
    return f"{angka(nilai, desimal)}%"
