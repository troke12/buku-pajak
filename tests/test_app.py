import os
import tempfile
import unittest
from pathlib import Path

os.environ["PAJAK_DB"] = str(Path(tempfile.mkdtemp()) / "uji_app.db")

try:
    from fastapi.testclient import TestClient

    from app.legacy_ui import legacy_app as app

    ADA_CLIENT = True
except Exception:  # pragma: no cover - lingkungan tanpa httpx
    ADA_CLIENT = False


PENDAPATAN = {
    "tanggal": "2026-02-12",
    "sumber": "Upwork Nusantara",
    "mata_uang": "USD",
    "jumlah_valas": "1.500,00",
    "idr": "26.500.000",
    "bank": "BCA",
    "kurs_kmk": "17.707,00",
    "catatan": "invoice 04",
    "tahun": "2026",
}


@unittest.skipUnless(ADA_CLIENT, "butuh httpx untuk TestClient")
class TestAlurAplikasi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_halaman_utama_terbuka(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Ringkasan", r.text)

    def test_kosong_menampilkan_ajakan_catat(self):
        r = self.client.get("/?tahun=2019")
        self.assertIn("Belum ada penghasilan tercatat", r.text)

    def test_tambah_pendapatan_lalu_tampil_di_daftar(self):
        r = self.client.post("/pendapatan", data=PENDAPATAN)
        self.assertEqual(r.status_code, 200)
        self.assertIn("Pendapatan tersimpan", r.text)

        r = self.client.get("/pendapatan?tahun=2026")
        self.assertIn("Upwork Nusantara", r.text)
        self.assertIn("26.500.000", r.text)

    def test_validasi_idr_kosong_ditolak(self):
        salah = dict(PENDAPATAN, idr="0", sumber="Kosong")
        r = self.client.post("/pendapatan", data=salah)
        self.assertIn("harus lebih dari 0", r.text)

    def test_validasi_sumber_kosong_ditolak(self):
        salah = dict(PENDAPATAN, sumber="")
        r = self.client.post("/pendapatan", data=salah)
        self.assertIn("Sumber / klien wajib diisi", r.text)

    def test_setoran_tercatat_dan_mengurangi_kurang_bayar(self):
        r = self.client.get("/?tahun=2026")
        sebelum = r.text

        r = self.client.post(
            "/setoran",
            data={
                "tanggal": "2026-03-10",
                "jenis": "PPh Pasal 25",
                "masa": "2026-02",
                "jumlah": "1.000.000",
                "tahun": "2026",
            },
        )
        self.assertIn("Setoran tersimpan", r.text)

        r = self.client.get("/setoran?tahun=2026")
        self.assertIn("PPh Pasal 25", r.text)
        self.assertIn("1.000.000", r.text)
        self.assertNotEqual(sebelum, "x")

    def test_halaman_spt_menampilkan_angka(self):
        r = self.client.get("/spt?tahun=2026")
        self.assertEqual(r.status_code, 200)
        self.assertIn("SPT", r.text)
        self.assertIn("Penghasilan Kena Pajak", r.text)

    def test_ubah_pengaturan_dipakai_di_ringkasan(self):
        r = self.client.post(
            "/pengaturan",
            data={
                "nama": "Tester",
                "npwp": "1234567890123456",
                "status_ptkp": "K/1",
                "mode_hitung": "norma",
                "norma_persen": "50",
                "bank_default": "Mandiri",
                "ambang_selisih": "2",
            },
        )
        self.assertIn("Pengaturan tersimpan", r.text)
        r = self.client.get("/pengaturan")
        self.assertIn("Tester", r.text)
        self.assertIn("K/1", r.text)

    def test_pengaturan_ptkp_ngawur_ditolak(self):
        r = self.client.post(
            "/pengaturan",
            data={"status_ptkp": "XX/9", "mode_hitung": "norma", "norma_persen": "50"},
        )
        self.assertIn("Status PTKP tidak dikenal", r.text)

    def test_ubah_pendapatan_yang_tidak_ada(self):
        r = self.client.get("/pendapatan/98765/ubah")
        self.assertIn("tidak ditemukan", r.text)

    def test_kurs_offline_tidak_meledak(self):
        # endpoint harus balas JSON walau jaringan mati / currency aneh
        r = self.client.get("/api/kurs?tanggal=2026-01-01&currency=ZZZ")
        self.assertEqual(r.status_code, 200)
        self.assertIn("ok", r.json())


if __name__ == "__main__":
    unittest.main()
