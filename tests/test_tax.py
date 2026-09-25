import unittest
from decimal import Decimal

from app.tax import (
    bulatkan,
    hitung_neto,
    hitung_pkp,
    hitung_pph,
    hitung_ptkp,
    ringkasan_tahunan,
)


class TestPTKP(unittest.TestCase):
    def test_dasar_tidak_kawin(self):
        self.assertEqual(hitung_ptkp("TK/0"), Decimal("54000000"))

    def test_kawin(self):
        self.assertEqual(hitung_ptkp("K/0"), Decimal("58500000"))

    def test_kawin_tiga_tanggungan(self):
        self.assertEqual(hitung_ptkp("K/3"), Decimal("72000000"))

    def test_tanggungan_dibatasi_tiga(self):
        self.assertEqual(hitung_ptkp("K/9"), hitung_ptkp("K/3"))

    def test_penghasilan_istri_digabung(self):
        self.assertEqual(hitung_ptkp("K/I/0"), Decimal("112500000"))

    def test_status_kosong_dianggap_tk0(self):
        self.assertEqual(hitung_ptkp(""), Decimal("54000000"))


class TestNetoDanPkp(unittest.TestCase):
    def test_norma_setengah(self):
        self.assertEqual(hitung_neto(300_000_000, "norma", 50), Decimal("150000000"))

    def test_norma_persen_kustom(self):
        self.assertEqual(hitung_neto(200_000_000, "norma", 40), Decimal("80000000"))

    def test_pembukuan_dikurangi_biaya(self):
        self.assertEqual(hitung_neto(350_000_000, "pembukuan", 50, 100_000_000), Decimal("250000000"))

    def test_pembukuan_biaya_melebihi_bruto_tidak_negatif(self):
        self.assertEqual(hitung_neto(50_000_000, "pembukuan", 50, 80_000_000), Decimal("0"))

    def test_pkp_dikurangi_ptkp(self):
        self.assertEqual(hitung_pkp(150_000_000, 54_000_000), Decimal("96000000"))

    def test_pkp_tidak_negatif(self):
        self.assertEqual(hitung_pkp(40_000_000, 54_000_000), Decimal("0"))


class TestPphProgresif(unittest.TestCase):
    def test_pkp_nol(self):
        total, rincian = hitung_pph(0)
        self.assertEqual(total, Decimal("0"))
        self.assertEqual(rincian, [])

    def test_lapisan_pertama(self):
        total, _ = hitung_pph(50_000_000)
        self.assertEqual(total, Decimal("2500000"))

    def test_dua_lapisan_contoh_artikel(self):
        # 121jt -> 5% x 60jt + 15% x 61jt = 12.150.000
        total, rincian = hitung_pph(121_000_000)
        self.assertEqual(total, Decimal("12150000"))
        self.assertEqual(len(rincian), 2)

    def test_lima_lapisan_penuh(self):
        total, rincian = hitung_pph(6_000_000_000)
        self.assertEqual(len(rincian), 5)
        # 60jt*5% + 190jt*15% + 250jt*25% + 4.5M*30% + 1M*35%
        harapan = (
            Decimal("3000000")
            + Decimal("28500000")
            + Decimal("62500000")
            + Decimal("1350000000")
            + Decimal("350000000")
        )
        self.assertEqual(total, harapan)

    def test_pembulatan_rupiah(self):
        self.assertEqual(bulatkan(Decimal("1234.5")), 1235)


class TestRingkasan(unittest.TestCase):
    def test_norma_tk0(self):
        r = ringkasan_tahunan(350_000_000, status="TK/0", mode="norma", norma_persen=50)
        self.assertEqual(r.neto, Decimal("175000000"))
        self.assertEqual(r.ptkp, Decimal("54000000"))
        self.assertEqual(r.pkp, Decimal("121000000"))
        self.assertEqual(r.pph, Decimal("12150000"))
        self.assertEqual(r.kurang_bayar, Decimal("12150000"))
        self.assertEqual(r.pph25_bulanan, Decimal("12150000") / 12)

    def test_kredit_mengurangi_kurang_bayar(self):
        r = ringkasan_tahunan(350_000_000, kredit=5_000_000)
        self.assertEqual(r.kredit, Decimal("5000000"))
        self.assertEqual(r.kurang_bayar, Decimal("7150000"))

    def test_kredit_berlebih_jadi_lebih_bayar(self):
        r = ringkasan_tahunan(350_000_000, kredit=20_000_000)
        self.assertLess(r.kurang_bayar, 0)

    def test_penghasilan_di_bawah_ptkp_nihil(self):
        r = ringkasan_tahunan(100_000_000, status="TK/0", mode="norma", norma_persen=50)
        self.assertEqual(r.pkp, Decimal("0"))
        self.assertEqual(r.pph, Decimal("0"))

    def test_pembukuan(self):
        r = ringkasan_tahunan(350_000_000, mode="pembukuan", biaya=100_000_000)
        self.assertEqual(r.neto, Decimal("250000000"))
        self.assertEqual(r.pkp, Decimal("196000000"))
        # 60jt*5% + 136jt*15% = 3jt + 20.4jt
        self.assertEqual(r.pph, Decimal("23400000"))

    def test_tanpa_penghasilan(self):
        r = ringkasan_tahunan(0)
        self.assertEqual(r.bruto, Decimal("0"))
        self.assertEqual(r.pph, Decimal("0"))


if __name__ == "__main__":
    unittest.main()
