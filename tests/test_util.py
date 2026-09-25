import unittest
from decimal import Decimal

from app.util import angka, ke_angka, persen, rp, rupiah


class TestKeAngka(unittest.TestCase):
    def test_format_ribuan_indonesia(self):
        self.assertEqual(ke_angka("26.500.000"), Decimal("26500000"))

    def test_desimal_koma(self):
        self.assertEqual(ke_angka("1.500,50"), Decimal("1500.50"))

    def test_desimal_titik_tunggal(self):
        self.assertEqual(ke_angka("1500.5"), Decimal("1500.5"))

    def test_dengan_prefix_dan_spasi(self):
        self.assertEqual(ke_angka("Rp 1.000.000"), Decimal("1000000"))

    def test_kosong(self):
        self.assertEqual(ke_angka(""), Decimal("0"))
        self.assertEqual(ke_angka(None), Decimal("0"))

    def test_angka_polos(self):
        self.assertEqual(ke_angka("17707"), Decimal("17707"))

    def test_input_numerik(self):
        self.assertEqual(ke_angka(1500.5), Decimal("1500.5"))


class TestFormat(unittest.TestCase):
    def test_rupiah(self):
        self.assertEqual(rupiah(26500000), "26.500.000")

    def test_rp(self):
        self.assertEqual(rp(1500), "Rp 1.500")

    def test_angka_desimal(self):
        self.assertEqual(angka(1500.5), "1.500,50")

    def test_angka_none(self):
        self.assertEqual(angka(None), "-")

    def test_persen(self):
        self.assertEqual(persen(4.5, 1), "4,5%")


if __name__ == "__main__":
    unittest.main()
