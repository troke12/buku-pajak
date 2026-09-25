"""Engine hitung PPh Orang Pribadi untuk pekerjaan bebas.

Dasar aturan yang dipakai:
- Tarif progresif Pasal 17 UU PPh jo. UU HPP: 5% / 15% / 25% / 30% / 35%.
- PTKP: PMK 101/PMK.010/2016.
- NPPN (norma): PER-17/PJ/2015 - pekerjaan bebas tenaga ahli umumnya 50% dari bruto.
- Pekerjaan bebas tidak boleh lagi pakai PPh Final UMKM 0,5% (PP 20/2026).

Basis penghasilan bruto = jumlah rupiah yang benar-benar diterima (masuk rekening).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

RUPIAH = Decimal("1")

PTKP_DASAR = Decimal("54000000")
PTKP_KAWIN = Decimal("4500000")
PTKP_TANGGUNGAN = Decimal("4500000")
PTKP_MAKS_TANGGUNGAN = 3

NORMA_DEFAULT = Decimal("50")

SATUAN_BULAT_PKP = Decimal("1000")

# (batas atas lapisan, tarif); None = lapisan terakhir tanpa batas
LAPISAN_TARIF: list[tuple[Decimal | None, Decimal]] = [
    (Decimal("60000000"), Decimal("0.05")),
    (Decimal("250000000"), Decimal("0.15")),
    (Decimal("500000000"), Decimal("0.25")),
    (Decimal("5000000000"), Decimal("0.30")),
    (None, Decimal("0.35")),
]

STATUS_SAH = ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3", "K/I/0", "K/I/1", "K/I/2", "K/I/3"]


def bulatkan(nilai) -> int:
    """Bulatkan ke rupiah penuh (half up)."""
    return int(Decimal(nilai).quantize(RUPIAH, rounding=ROUND_HALF_UP))


def hitung_ptkp(status: str) -> Decimal:
    """PTKP setahun berdasarkan status (mis. 'TK/0', 'K/1', 'K/I/0')."""
    bagian = [p.strip().upper() for p in str(status or "TK/0").split("/")]
    kawin = bagian[0] == "K"
    gabung = len(bagian) >= 3 and bagian[1] == "I"

    try:
        tanggungan = int(bagian[-1])
    except (ValueError, IndexError):
        tanggungan = 0
    tanggungan = max(0, min(tanggungan, PTKP_MAKS_TANGGUNGAN))

    total = PTKP_DASAR
    if kawin:
        total += PTKP_KAWIN
    if gabung:
        total += PTKP_DASAR
    total += PTKP_TANGGUNGAN * tanggungan
    return total


def hitung_neto(bruto, mode: str, norma_persen=NORMA_DEFAULT, biaya=0) -> Decimal:
    """Penghasilan neto: norma (persentase bruto) atau pembukuan (bruto - biaya)."""
    bruto = Decimal(bruto)
    if str(mode) == "pembukuan":
        neto = bruto - Decimal(biaya)
        return neto if neto > 0 else Decimal(0)
    return bruto * (Decimal(norma_persen) / Decimal(100))


def hitung_pkp(neto, ptkp) -> Decimal:
    """PKP = neto - PTKP (minimum 0), dibulatkan ke bawah per Rp1.000 sebelum
    kena tarif — wajib per Pasal 17 ayat (4) UU PPh, masih berlaku di era Coretax
    (PER-11/PJ/2025)."""
    pkp = Decimal(neto) - Decimal(ptkp)
    if pkp <= 0:
        return Decimal(0)
    return (pkp // SATUAN_BULAT_PKP) * SATUAN_BULAT_PKP


def hitung_pph(pkp_nilai) -> tuple[Decimal, list[dict]]:
    """PPh terutang + rincian per lapisan tarif progresif."""
    sisa = Decimal(pkp_nilai)
    bawah = Decimal(0)
    total = Decimal(0)
    rincian: list[dict] = []

    for batas, tarif in LAPISAN_TARIF:
        if sisa <= 0:
            break
        lebar = sisa if batas is None else min(sisa, batas - bawah)
        pajak = lebar * tarif
        rincian.append(
            {
                "dari": bawah,
                "sampai": batas,
                "tarif": tarif,
                "dasar": lebar,
                "pajak": pajak,
            }
        )
        total += pajak
        sisa -= lebar
        if batas is not None:
            bawah = batas

    return total, rincian


@dataclass
class Ringkasan:
    bruto: Decimal = Decimal(0)
    neto: Decimal = Decimal(0)
    ptkp: Decimal = Decimal(0)
    pkp: Decimal = Decimal(0)
    pph: Decimal = Decimal(0)
    kredit: Decimal = Decimal(0)
    kurang_bayar: Decimal = Decimal(0)
    pph25_bulanan: Decimal = Decimal(0)
    status: str = "TK/0"
    mode: str = "norma"
    norma_persen: Decimal = NORMA_DEFAULT
    biaya: Decimal = Decimal(0)
    rincian: list[dict] = field(default_factory=list)


def ringkasan_tahunan(
    bruto,
    status: str = "TK/0",
    mode: str = "norma",
    norma_persen=NORMA_DEFAULT,
    biaya=0,
    kredit=0,
) -> Ringkasan:
    """Ringkasan setahun: bruto -> neto -> PKP -> PPh terutang -> kurang bayar."""
    bruto_d = Decimal(bruto)
    neto = hitung_neto(bruto_d, mode, norma_persen, biaya)
    ptkp = hitung_ptkp(status)
    pkp = hitung_pkp(neto, ptkp)
    pph, rincian = hitung_pph(pkp)
    kredit_d = Decimal(kredit)

    return Ringkasan(
        bruto=bruto_d,
        neto=neto,
        ptkp=ptkp,
        pkp=pkp,
        pph=pph,
        kredit=kredit_d,
        kurang_bayar=pph - kredit_d,
        pph25_bulanan=pph / 12,
        status=status,
        mode=str(mode),
        norma_persen=Decimal(norma_persen),
        biaya=Decimal(biaya),
        rincian=rincian,
    )
