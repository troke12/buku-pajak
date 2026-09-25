<p align="center">
  <img src="coretax-breaker.png" alt="Coretax Breaker" width="540">
</p>

# Buku Pajak

> Sebuah aplikasi buat pekerja freelancer tapi terpaksa buat laporan pajak dan harus berapa
> bayarnya karena aturan bangsa konoha biar NPWP nya tetep aktif.

Pencatatan penghasilan dan hitung PPh untuk **pekerjaan bebas** (freelancer).

Sederhananya: lo tarik mutasi rekening BCA/Mandiri, lalu catat tiap penerimaan apa adanya.
Uangnya sudah dalam rupiah, jadi **tidak ada konversi mata uang** di aplikasi ini — kolom
rupiah yang masuk rekening itulah yang jadi dasar perhitungan pajak.

- Rancangan lengkap: [`docs/SYSTEM-DESIGN.md`](docs/SYSTEM-DESIGN.md)
- Token desain: [`web/src/index.css`](web/src/index.css)

## Tampilan

<p align="center">
  <img src="docs/screenshot/ringkasan.png" alt="Halaman Ringkasan: estimasi PPh, rincian lapisan tarif, grafik per bulan, rekap per bank dan per klien" width="900">
  <br>
  <sub>Ringkasan — estimasi PPh setahun, rincian per lapisan tarif, grafik per bulan, rekap per bank &amp; per klien.</sub>
</p>

<p align="center">
  <img src="docs/screenshot/pendapatan.png" alt="Tabel pendapatan dengan pencarian dan pengurutan" width="900">
  <br>
  <sub>Pendapatan — tiap penerimaan dari mutasi rekening, bisa dicari dan diurutkan.</sub>
</p>

<p align="center">
  <img src="docs/screenshot/form-pendapatan.png" alt="Form catat pendapatan" width="760">
  <br>
  <sub>Catat pendapatan — tanggal, klien, jumlah masuk rekening, bank.</sub>
</p>

<p align="center">
  <img src="docs/screenshot/spt.png" alt="Halaman SPT 1770 berisi angka siap dipindah ke Coretax dan urutan pelaporannya" width="820">
  <br>
  <sub>SPT 1770 — angka siap dipindah ke Coretax, kewajiban NPPN, urutan lapor, dan tenggat.</sub>
</p>

<p align="center">
  <img src="docs/screenshot/tema-gelap.png" alt="Tampilan tema gelap" width="900">
  <br>
  <sub>Tema gelap (ikut preferensi sistem, bisa diganti manual).</sub>
</p>

## Kenapa dibuat begini

- Sejak **PP 20/2026** (efektif 22 April 2026), penghasilan dari **pekerjaan bebas tidak lagi
  boleh** pakai PPh Final UMKM 0,5%. Dasar hitungnya jadi tarif progresif Pasal 17 lewat
  **norma (NPPN)** atau **pembukuan**.
- Penghasilan dari klien luar negeri tetap objek pajak Indonesia (worldwide income), dan
  klien LN umumnya tidak memotong pajak, jadi setor sendiri.
- SPT-nya pakai **1770** (bukan 1770 S/SS) lewat Coretax, paling lambat 31 Maret.
- Kalau pakai norma, **pemberitahuan pemakaian NPPN wajib disampaikan paling lambat 31 Maret**
  (tiga bulan pertama tahun pajak) lewat layanan pemberitahuan norma di Coretax. Kalau tidak,
  lo **dianggap memilih pembukuan**. Catatan: wajib menyelenggarakan pencatatan (aplikasi ini
  salah satu bentuknya), dan omzet gabungan satu keluarga tidak melebihi Rp4,8 miliar.

## Arsitektur singkat

**Monolith satu proses.** Satu perintah `uvicorn` menyajikan API dan tampilan sekaligus di satu
port. Tidak ada proses kedua, tidak ada CORS.

- **Tampilan**: SPA React 19 + TypeScript, shadcn/ui (Radix) + Tailwind CSS v4, TanStack Query,
  TanStack Table v9, React Hook Form + Zod, Recharts, Sonner. Ada tema terang & gelap.
- **API**: FastAPI + pydantic. Engine pajak Python terpisah dari UI, jadi bisa diuji tanpa browser.
- **Data**: SQLite satu file di `data/pajak.db`.

## Menjalankan

Butuh Python 3.10+ dan Node 20+.

```bash
./run.sh
```

Itu saja. Skripnya membangun frontend kalau belum ada, lalu menjalankan semuanya di
<http://127.0.0.1:8000>.

```bash
PORT=9000 ./run.sh     # ganti port
./run.sh --reload      # mode pengembangan (auto-reload)
```

Manual, kalau lebih suka:

```bash
cd web && npm install --include=dev && npm run build   # sekali saja
cd .. && python3 -m uvicorn app.main:app --port 8000
```

> Kalau `NODE_ENV=production` di-set global (seperti di mesin ini), npm melewati
> `devDependencies`. Pakai `npm install --include=dev`, kalau tidak `typescript` tidak
> terpasang dan `npm run build` gagal.

**Ingin hot-reload saat mengubah tampilan?** Opsional, jalankan dev server Vite di terminal
lain; `/api` otomatis diproksi ke port 8000:

```bash
cd web && npm run dev      # buka http://localhost:5173
```

## Alur pakai

1. **Pengaturan** — nama, NPWP, status PTKP, metode hitung, dan persentase norma (tenaga ahli
   umumnya 50%).
2. **Pendapatan** — catat tiap penerimaan dari mutasi rekening: tanggal uang masuk, klien,
   **jumlah yang masuk rekening**, dan bank. Kolom bisa disortir, ada pencarian.
3. **Setoran pajak** — catat setiap pembayaran (PPh 25 bulanan, PPh 29, dll) sebagai kredit pajak.
4. **Ringkasan** — estimasi PPh terutang, sudah disetor, sisa kurang bayar, rincian per lapisan
   tarif, grafik per bulan, plus rekap per bank dan per klien.
5. **SPT 1770** — angka siap dipindah ke Coretax, urutan pelaporan resmi, kewajiban NPPN, dan
   tenggat.

## Yang dihitung

| Komponen | Cara |
|---|---|
| Penghasilan bruto | Total kolom jumlah masuk rekening |
| Penghasilan neto | `norma% × bruto` (NPPN) atau `bruto − biaya usaha` (pembukuan) |
| PKP | `neto − PTKP` (minimum 0) |
| PPh terutang | Tarif progresif 5% / 15% / 25% / 30% / 35% |
| Kurang bayar | `PPh terutang − total setoran` |
| Angsuran PPh 25 | `PPh terutang ÷ 12` (indikasi untuk disisihkan) |

PTKP mengikuti PMK 101/PMK.010/2016: TK/0 Rp54 jt, tambahan kawin Rp4,5 jt, tambahan tiap
tanggungan Rp4,5 jt (maks 3), dan penghasilan istri digabung (K/I) ditambah Rp54 jt.

Urutan hitung ini sama dengan rumus resmi di panduan Coretaxpedia.

## Uji

```bash
# backend — 83 tes
python3 -m unittest discover -s tests -v

# frontend — typecheck + build produksi
cd web && npm run build
```

## Data & backup

Semua data lokal di satu file SQLite (`data/pajak.db`). Backup = salin file itu. Aplikasi ini
**tidak melakukan panggilan jaringan sama sekali** — tidak ada data yang keluar dari mesin lo.

Kalau database dibuat sebelum konsep konversi valas dihapus, kolom `mata_uang`, `jumlah_valas`,
dan `kurs_kmk` dibuang otomatis saat aplikasi dibuka. Baris datanya tidak hilang.

## Batasan

- Mode **norma** dan **pembukuan** sudah didukung, tapi kredit pajak luar negeri (PPh 24) masih
  dicatat manual sebagai setoran, belum dihitung otomatis per negara.
- Belum ada PPN. Kalau nanti lo jadi PKP, perlu modul terpisah.
- Belum ada impor mutasi rekening; input masih satu per satu (menyusul, karena alur kerjanya
  memang dari mutasi BCA/Mandiri).
- UI lama (server-rendered Jinja2) sudah **tidak dipasang lagi** di aplikasi utama. Filenya
  masih ada di `app/legacy_ui.py`, `app/templates`, dan `app/static` supaya tidak ada yang
  hilang, dan masih diuji lewat `tests/test_app.py`. Perlu dicatat: UI itu **belum ikut
  disesuaikan** dengan penghapusan konversi valas, jadi beberapa kolomnya tampil kosong. Bisa
  dihapus kapan saja kalau mau bersih.
- `app/kurs.py` + `tests/test_kurs.py` juga disimpan tapi sudah tidak dipakai.

## Catatan

Alat bantu hitung, **bukan nasihat pajak**. Untuk keputusan pelaporan resmi, cocokkan dengan
ketentuan terbaru dan konsultan pajak/AR di KPP lo.
