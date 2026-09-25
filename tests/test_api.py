import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

os.environ.setdefault("PAJAK_DB", str(Path(tempfile.mkdtemp()) / "uji_api_dasar.db"))

try:
    from fastapi.testclient import TestClient

    from app import api as api_mod
    from app.main import app

    ADA_CLIENT = True
except Exception:  # pragma: no cover
    ADA_CLIENT = False

DB_UJI = Path(tempfile.mkdtemp()) / "uji_api.db"


@unittest.skipUnless(ADA_CLIENT, "butuh httpx untuk TestClient")
class TestApiPajak(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # isolasi database dari modul tes lain
        api_mod.DB_PATH = DB_UJI
        cls.client = TestClient(app)

    def _bersihkan(self, tahun: str = "2031"):
        for p in self.client.get(f"/api/pendapatan?tahun={tahun}").json():
            self.client.delete(f"/api/pendapatan/{p['id']}")
        for s in self.client.get(f"/api/setoran?tahun={tahun}").json():
            self.client.delete(f"/api/setoran/{s['id']}")

    # ------------------------------------------------------------- dasar

    def test_sehat(self):
        r = self.client.get("/api/sehat")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["ok"])

    def test_daftar_tahun(self):
        r = self.client.get("/api/tahun")
        self.assertEqual(r.status_code, 200)
        self.assertIn(str(__import__("datetime").datetime.now().year), r.json())

    # -------------------------------------------------------- pengaturan

    def test_pengaturan_default_dan_simpan(self):
        awal = self.client.get("/api/pengaturan").json()
        self.assertEqual(awal["status_ptkp"], "TK/0")

        baru = {**awal, "nama": "Uji API", "status_ptkp": "K/1", "norma_persen": 40}
        r = self.client.put("/api/pengaturan", json=baru)
        self.assertEqual(r.status_code, 200)

        lagi = self.client.get("/api/pengaturan").json()
        self.assertEqual(lagi["nama"], "Uji API")
        self.assertEqual(lagi["status_ptkp"], "K/1")
        self.assertEqual(lagi["norma_persen"], 40)

    def test_pengaturan_status_ptkp_ngawur_ditolak(self):
        awal = self.client.get("/api/pengaturan").json()
        r = self.client.put("/api/pengaturan", json={**awal, "status_ptkp": "XX/9"})
        self.assertEqual(r.status_code, 422)

    def test_pengaturan_norma_di_luar_rentang_ditolak(self):
        awal = self.client.get("/api/pengaturan").json()
        r = self.client.put("/api/pengaturan", json={**awal, "norma_persen": 0})
        self.assertEqual(r.status_code, 422)

    # -------------------------------------------------------- pendapatan

    def test_alur_pendapatan_lengkap(self):
        self._bersihkan()
        isi = {
            "tanggal": "2031-03-04",
            "sumber": "Klien Uji",
            "idr": 16_500_000,
            "bank": "BCA",
            "catatan": "invoice uji",
        }
        r = self.client.post("/api/pendapatan", json=isi)
        self.assertEqual(r.status_code, 201)
        dibuat = r.json()
        self.assertGreater(dibuat["id"], 0)
        self.assertEqual(dibuat["sumber"], "Klien Uji")

        daftar = self.client.get("/api/pendapatan?tahun=2031").json()
        self.assertEqual(len(daftar), 1)

        ubah = {**isi, "sumber": "Klien Uji 2", "idr": 17_000_000}
        r = self.client.put(f"/api/pendapatan/{dibuat['id']}", json=ubah)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["sumber"], "Klien Uji 2")

        r = self.client.delete(f"/api/pendapatan/{dibuat['id']}")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.client.get("/api/pendapatan?tahun=2031").json(), [])

    def test_idr_nol_ditolak(self):
        r = self.client.post(
            "/api/pendapatan",
            json={"tanggal": "2031-01-01", "sumber": "X", "idr": 0},
        )
        self.assertEqual(r.status_code, 422)

    def test_sumber_kosong_ditolak(self):
        r = self.client.post(
            "/api/pendapatan",
            json={"tanggal": "2031-01-01", "sumber": "   ", "idr": 1000},
        )
        self.assertEqual(r.status_code, 422)

    def test_tanggal_ngawur_ditolak(self):
        r = self.client.post(
            "/api/pendapatan",
            json={"tanggal": "01-01-2031", "sumber": "X", "idr": 1000},
        )
        self.assertEqual(r.status_code, 422)

    def test_ubah_data_tidak_ada_404(self):
        isi = {"tanggal": "2031-01-01", "sumber": "X", "idr": 1000}
        self.assertEqual(self.client.put("/api/pendapatan/999999", json=isi).status_code, 404)
        self.assertEqual(self.client.delete("/api/pendapatan/999999").status_code, 404)

    # ----------------------------------------------------------- setoran

    def test_setoran_tambah_dan_hapus(self):
        self._bersihkan()
        r = self.client.post(
            "/api/setoran",
            json={"tanggal": "2031-04-10", "jenis": "PPh Pasal 25", "masa": "2031-03", "jumlah": 1_000_000},
        )
        self.assertEqual(r.status_code, 201)
        id_ = r.json()["id"]

        daftar = self.client.get("/api/setoran?tahun=2031").json()
        self.assertEqual(len(daftar), 1)
        self.assertEqual(daftar[0]["jumlah"], 1_000_000)

        self.assertEqual(self.client.delete(f"/api/setoran/{id_}").status_code, 204)
        self.assertEqual(self.client.get("/api/setoran?tahun=2031").json(), [])

    def test_setoran_jumlah_nol_ditolak(self):
        r = self.client.post(
            "/api/setoran",
            json={"tanggal": "2031-04-10", "jenis": "PPh Pasal 25", "jumlah": 0},
        )
        self.assertEqual(r.status_code, 422)

    # --------------------------------------------------------- ringkasan

    def test_ringkasan_hitungan(self):
        self._bersihkan()
        # bruto 350jt, norma 50% (default) -> neto 175jt, PTKP TK/0 54jt -> PKP 121jt
        self.client.put(
            "/api/pengaturan",
            json={
                "nama": "Uji",
                "npwp": "",
                "status_ptkp": "TK/0",
                "mode_hitung": "norma",
                "norma_persen": 50,
                "bank_default": "BCA",
            },
        )
        self.client.post(
            "/api/pendapatan",
            json={"tanggal": "2031-01-05", "sumber": "A", "idr": 350_000_000},
        )
        self.client.post(
            "/api/setoran",
            json={"tanggal": "2031-02-10", "jenis": "PPh Pasal 25", "jumlah": 5_000_000},
        )

        data = self.client.get("/api/ringkasan?tahun=2031").json()
        self.assertEqual(data["bruto"], 350_000_000)
        self.assertEqual(data["neto"], 175_000_000)
        self.assertEqual(data["ptkp"], 54_000_000)
        self.assertEqual(data["pkp"], 121_000_000)
        self.assertEqual(data["pph"], 12_150_000)
        self.assertEqual(data["kredit"], 5_000_000)
        self.assertEqual(data["kurang_bayar"], 7_150_000)
        self.assertEqual(len(data["rincian"]), 2)
        self.assertEqual(len(data["per_bulan"]), 12)
        self._bersihkan()

    def test_ringkasan_agregat_per_bank(self):
        self._bersihkan()
        self.client.post(
            "/api/pendapatan",
            json={"tanggal": "2031-05-02", "sumber": "A", "idr": 5_000_000, "bank": "BCA"},
        )
        self.client.post(
            "/api/pendapatan",
            json={"tanggal": "2031-05-03", "sumber": "B", "idr": 7_000_000, "bank": "Mandiri"},
        )
        data = self.client.get("/api/ringkasan?tahun=2031").json()
        self.assertEqual({b["bank"]: b["total"] for b in data["per_bank"]},
                         {"BCA": 5_000_000, "Mandiri": 7_000_000})
        # sisa konsep valas harus benar-benar hilang dari muatan API
        self.assertNotIn("selisih_kurs", data)
        self.assertNotIn("penghasilan_luar_negeri", data)
        self._bersihkan()

    def test_pendapatan_tidak_punya_field_valas(self):
        self._bersihkan()
        r = self.client.post(
            "/api/pendapatan",
            json={"tanggal": "2031-07-01", "sumber": "C", "idr": 1_000_000},
        )
        self.assertEqual(r.status_code, 201)
        for usang in ("mata_uang", "jumlah_valas", "kurs_kmk"):
            self.assertNotIn(usang, r.json())
        self._bersihkan()

    # -------------------------------------------------------------- biaya

    def test_biaya_upsert(self):
        r = self.client.put("/api/biaya", json={"tahun": "2031", "jumlah": 12_000_000, "catatan": "perangkat"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/biaya?tahun=2031").json()["jumlah"], 12_000_000)

        self.client.put("/api/biaya", json={"tahun": "2031", "jumlah": 15_000_000, "catatan": "perangkat + langganan"})
        self.assertEqual(self.client.get("/api/biaya?tahun=2031").json()["jumlah"], 15_000_000)

    # ------------------------------------------- regresi: koneksi lintas thread

    def test_permintaan_banyak_sekaligus(self):
        """FastAPI menjalankan endpoint sinkron di thread pool. Koneksi SQLite
        satu per request harus tetap bisa dipakai lintas thread."""
        for p in self.client.get("/api/pendapatan?tahun=2031").json():
            self.client.delete(f"/api/pendapatan/{p['id']}")
        self.client.post(
            "/api/pendapatan",
            json={"tanggal": "2031-06-01", "sumber": "Paralel", "idr": 1_000_000, "mata_uang": "IDR"},
        )

        def ambil(_):
            return self.client.get("/api/pendapatan?tahun=2031").status_code

        with ThreadPoolExecutor(max_workers=8) as pool:
            hasil = list(pool.map(ambil, range(24)))

        self.assertEqual(set(hasil), {200}, f"ada status gagal: {sorted(set(hasil))}")
        self._bersihkan()


if __name__ == "__main__":
    unittest.main()
