import tempfile
import unittest
from pathlib import Path

from app import db


def db_sementara():
    return db.buka_db(Path(tempfile.mkdtemp()) / "uji.db")


class TestPendapatan(unittest.TestCase):
    def setUp(self):
        self.conn = db_sementara()
        db.init_db(self.conn)

    def tearDown(self):
        self.conn.close()

    def tambah(self, tanggal, sumber, idr, bank=None, catatan=None):
        return db.tambah_pendapatan(
            self.conn,
            {
                "tanggal": tanggal,
                "sumber": sumber,
                "idr": idr,
                "bank": bank or "BCA",
                "catatan": catatan,
            },
        )

    def test_tambah_dan_ambil(self):
        id_ = self.tambah("2026-01-15", "Upwork", 15_000_000)
        data = db.ambil_pendapatan(self.conn, id_)
        self.assertEqual(data["sumber"], "Upwork")
        self.assertEqual(data["idr"], 15_000_000)
        self.assertEqual(data["bank"], "BCA")

    def test_tidak_ada_kolom_valas(self):
        """Basis hitung selalu IDR; kolom mata uang/valas/kurs sudah dibuang."""
        kolom = {b["name"] for b in self.conn.execute("PRAGMA table_info(pendapatan)")}
        self.assertNotIn("mata_uang", kolom)
        self.assertNotIn("jumlah_valas", kolom)
        self.assertNotIn("kurs_kmk", kolom)
        self.assertEqual(kolom, {"id", "tanggal", "sumber", "idr", "bank", "catatan", "dibuat"})

    def test_total_hanya_tahun_dipilih(self):
        self.tambah("2026-01-15", "A", 10_000_000)
        self.tambah("2026-03-02", "B", 5_000_000)
        self.tambah("2025-12-31", "C", 99_000_000)
        self.assertEqual(db.total_bruto(self.conn, "2026"), 15_000_000)
        self.assertEqual(db.total_bruto(self.conn, "2025"), 99_000_000)

    def test_bruto_per_bulan(self):
        self.tambah("2026-01-15", "A", 10_000_000)
        self.tambah("2026-01-28", "B", 5_000_000)
        self.tambah("2026-08-01", "C", 7_000_000)
        hasil = db.bruto_per_bulan(self.conn, "2026")
        self.assertEqual(len(hasil), 12)
        self.assertEqual(hasil[0], 15_000_000)
        self.assertEqual(hasil[7], 7_000_000)
        self.assertEqual(hasil[11], 0)

    def test_bruto_per_sumber_diurutkan(self):
        self.tambah("2026-02-01", "Upwork", 10_000_000)
        self.tambah("2026-02-02", "Upwork", 2_000_000)
        self.tambah("2026-02-03", "Fiverr", 20_000_000)
        hasil = db.bruto_per_sumber(self.conn, "2026")
        self.assertEqual(hasil[0]["sumber"], "Fiverr")
        self.assertEqual(hasil[1]["total"], 12_000_000)
        self.assertEqual(hasil[1]["jumlah_transaksi"], 2)

    def test_bruto_per_bank(self):
        self.tambah("2026-02-01", "Upwork", 10_000_000, bank="BCA")
        self.tambah("2026-02-02", "Upwork", 2_000_000, bank="BCA")
        self.tambah("2026-02-03", "Fiverr", 20_000_000, bank="Mandiri")
        hasil = db.bruto_per_bank(self.conn, "2026")
        self.assertEqual(hasil[0]["bank"], "Mandiri")
        self.assertEqual(hasil[1]["total"], 12_000_000)
        self.assertEqual(hasil[1]["jumlah_transaksi"], 2)

    def test_ubah_dan_hapus(self):
        id_ = self.tambah("2026-04-01", "A", 1_000_000)
        db.ubah_pendapatan(
            self.conn,
            id_,
            {
                "tanggal": "2026-04-02",
                "sumber": "A2",
                "idr": 2_000_000,
                "bank": "Mandiri",
                "catatan": "",
            },
        )
        data = db.ambil_pendapatan(self.conn, id_)
        self.assertEqual(data["sumber"], "A2")
        self.assertEqual(data["idr"], 2_000_000)
        self.assertEqual(data["bank"], "Mandiri")

        db.hapus_pendapatan(self.conn, id_)
        self.assertIsNone(db.ambil_pendapatan(self.conn, id_))

    def test_ambil_yang_tidak_ada(self):
        self.assertIsNone(db.ambil_pendapatan(self.conn, 999))


class TestSetoranDanBiaya(unittest.TestCase):
    def setUp(self):
        self.conn = db_sementara()
        db.init_db(self.conn)

    def tearDown(self):
        self.conn.close()

    def test_setoran_total_dan_jenis(self):
        db.tambah_setoran(self.conn, {"tanggal": "2026-02-10", "jenis": "PPh Pasal 25", "jumlah": 1_000_000})
        db.tambah_setoran(self.conn, {"tanggal": "2026-03-10", "jenis": "PPh Pasal 25", "jumlah": 1_000_000})
        db.tambah_setoran(self.conn, {"tanggal": "2026-03-20", "jenis": "PPh Pasal 29", "jumlah": 500_000})
        self.assertEqual(db.total_setoran(self.conn, "2026"), 2_500_000)
        jenis = {j["jenis"]: j["total"] for j in db.setoran_per_jenis(self.conn, "2026")}
        self.assertEqual(jenis["PPh Pasal 25"], 2_000_000)
        self.assertEqual(jenis["PPh Pasal 29"], 500_000)

    def test_biaya_upsert(self):
        self.assertEqual(db.ambil_biaya(self.conn, "2026"), 0)
        db.simpan_biaya(self.conn, "2026", 10_000_000, "perangkat")
        self.assertEqual(db.ambil_biaya(self.conn, "2026"), 10_000_000)
        db.simpan_biaya(self.conn, "2026", 12_000_000, "perangkat + langganan")
        self.assertEqual(db.ambil_biaya(self.conn, "2026"), 12_000_000)

    def test_daftar_tahun_gabungan(self):
        db.tambah_pendapatan(self.conn, {"tanggal": "2025-05-01", "sumber": "A", "idr": 1000})
        db.tambah_setoran(self.conn, {"tanggal": "2026-01-05", "jenis": "PPh Pasal 25", "jumlah": 1000})
        db.simpan_biaya(self.conn, "2024", 500, "")
        self.assertEqual(db.daftar_tahun(self.conn), ["2026", "2025", "2024"])


class TestPengaturan(unittest.TestCase):
    def setUp(self):
        self.conn = db_sementara()
        db.init_db(self.conn)

    def tearDown(self):
        self.conn.close()

    def test_default(self):
        p = db.ambil_pengaturan(self.conn)
        self.assertEqual(p["status_ptkp"], "TK/0")
        self.assertEqual(p["norma_persen"], "50")

    def test_simpan_dan_baca(self):
        db.simpan_pengaturan(self.conn, {"nama": "Budi", "status_ptkp": "K/1", "norma_persen": "40"})
        p = db.ambil_pengaturan(self.conn)
        self.assertEqual(p["nama"], "Budi")
        self.assertEqual(p["status_ptkp"], "K/1")
        self.assertEqual(p["norma_persen"], "40")

    def test_upsert_tidak_duplikat(self):
        db.simpan_pengaturan(self.conn, {"nama": "A"})
        db.simpan_pengaturan(self.conn, {"nama": "B"})
        jumlah = self.conn.execute("SELECT COUNT(*) AS n FROM pengaturan WHERE kunci='nama'").fetchone()["n"]
        self.assertEqual(jumlah, 1)


class TestMigrasi(unittest.TestCase):
    """Database lama (era konversi valas) harus dibersihkan otomatis."""

    SKEMA_LAMA = """
    CREATE TABLE pendapatan (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal      TEXT    NOT NULL,
        sumber       TEXT    NOT NULL,
        mata_uang    TEXT    NOT NULL DEFAULT 'USD',
        jumlah_valas REAL,
        idr          INTEGER NOT NULL,
        bank         TEXT,
        kurs_kmk     REAL,
        catatan      TEXT,
        dibuat       TEXT    NOT NULL
    );
    CREATE TABLE pengaturan (kunci TEXT PRIMARY KEY, nilai TEXT);
    INSERT INTO pendapatan (tanggal, sumber, mata_uang, jumlah_valas, idr, kurs_kmk, dibuat)
    VALUES ('2026-01-01', 'Data Lama', 'USD', 100, 1500000, 15000, '2026-01-01T00:00:00');
    INSERT INTO pengaturan (kunci, nilai) VALUES ('ambang_selisih', '2');
    """

    def test_kolom_valas_dibuang_tapi_data_utuh(self):
        conn = db_sementara()
        conn.executescript(self.SKEMA_LAMA)
        conn.commit()

        db.init_db(conn)

        kolom = {b["name"] for b in conn.execute("PRAGMA table_info(pendapatan)")}
        for usang in ("mata_uang", "jumlah_valas", "kurs_kmk"):
            self.assertNotIn(usang, kolom)

        # baris lamanya jangan hilang, hanya kolom valas yang dibuang
        baris = conn.execute("SELECT sumber, idr, bank FROM pendapatan").fetchone()
        self.assertEqual(baris["sumber"], "Data Lama")
        self.assertEqual(baris["idr"], 1_500_000)

        # pengaturan lama dibersihkan
        sisa = conn.execute(
            "SELECT COUNT(*) AS n FROM pengaturan WHERE kunci = 'ambang_selisih'"
        ).fetchone()["n"]
        self.assertEqual(sisa, 0)
        self.assertNotIn("ambang_selisih", db.ambil_pengaturan(conn))

        conn.close()

    def test_init_dua_kali_aman(self):
        conn = db_sementara()
        conn.executescript(self.SKEMA_LAMA)
        conn.commit()
        db.init_db(conn)
        db.init_db(conn)  # tidak boleh error saat dijalankan ulang
        self.assertIsNotNone(db.ambil_pendapatan(conn, 1))
        conn.close()


if __name__ == "__main__":
    unittest.main()
