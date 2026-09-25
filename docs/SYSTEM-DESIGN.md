# System Design — Buku Pajak

Pencatatan penghasilan & hitung PPh untuk **pekerjaan bebas** (freelancer).

Penghasilan dicatat **apa adanya dari mutasi rekening BCA/Mandiri**. Uangnya sudah dalam
rupiah saat masuk rekening, jadi tidak ada konversi mata uang sama sekali: kolom rupiah yang
masuk rekening itulah basis perhitungan pajak.

Versi dokumen ini menggantikan rancangan lama (server-rendered Jinja2). Arsitektur sekarang:
**SPA React + shadcn/ui di depan, FastAPI sebagai API JSON di belakang**. Engine pajak Python
yang sudah teruji **dipertahankan**, bukan ditulis ulang.

---

## 1. Tujuan & prinsip

Tujuan: saat bayar dan lapor pajak tidak bingung, dan angka yang dilaporkan bisa
dipertanggungjawabkan.

Prinsip yang menentukan semua keputusan teknis:

1. **IDR yang masuk rekening adalah basis.** Bukan hasil konversi teoretis.
2. **Satu sumber angka: mutasi rekening.** Tidak ada konversi, tidak ada nilai teoretis.
   Yang dicatat = yang benar-benar masuk rekening.
3. **Satu kewajiban pajak = satu baris.** Pendapatan dan setoran dipisah supaya kredit pajak
   bisa ditelusuri.
4. **Logika pajak tidak boleh tergantung UI.** Engine murni, bisa diuji tanpa browser.
5. **Data lokal, satu file.** Tanpa akun, tanpa server pihak ketiga, mudah di-backup.

## 2. Ruang lingkup

**Termasuk:** pencatatan penerimaan dari mutasi rekening (rupiah), hitung PPh dengan norma
(NPPN) atau pembukuan, kredit pajak, rekap siap-SPT, rekap per bank/klien, tema terang/gelap.

**Tidak termasuk (v1):** PPN/PKP, kredit pajak luar negeri (PPh 24) otomatis per negara,
impor mutasi rekening otomatis, e-billing langsung ke DJP, multi-wajib-pajak, dan **konversi
mata uang** (sengaja: uang sudah masuk rekening dalam rupiah).

## 3. Dasar aturan & sumber

| Aturan | Dipakai untuk | Sumber |
|---|---|---|
| PP 20/2026 | Pekerjaan bebas **tidak** boleh pakai PPh Final UMKM 0,5% | pajak.go.id |
| PP 55/2022 Pasal 56–60 | Rezim UMKM & fasilitas Rp500 juta (konteks) | pajak.go.id |
| Pasal 17 UU PPh jo. UU HPP | Tarif progresif 5/15/25/30/35% | UU HPP |
| PMK 101/PMK.010/2016 | PTKP | PMK |
| PER-17/PJ/2015 | Norma (NPPN) per profesi & wilayah | PER-DJP |
| Coretaxpedia | Alur lapor SPT, kode billing, BPE | pajak.go.id/coretaxpedia |

Alur hitung yang dipakai **sama persis** dengan rumus resmi Coretaxpedia
(slug `penghasilan-dari-pekerjaan-bebas`):

```
Bruto × Norma                  = Penghasilan Neto
Penghasilan Neto − PTKP        = PKP
PKP × Tarif Pasal 17           = Pajak Terutang
Pajak Terutang − Kredit Pajak  = Kurang / Lebih Bayar
```

Kewajiban pendamping dari sumber resmi yang juga tercermin di UI: pemberitahuan pemakaian
norma **paling lambat 3 bulan pertama tahun pajak (31 Maret)**, wajib menyelenggarakan
**pencatatan** meski tidak membuat pembukuan, dan omzet gabungan keluarga ≤ Rp4,8 miliar.
Kalau pemberitahuan norma tidak disampaikan, wajib pajak **dianggap memilih pembukuan**.

## 4. Arsitektur (monolith satu proses)

Satu proses FastAPI menyajikan API dan SPA sekaligus. **Tidak ada proses kedua dan tidak ada
CORS**: browser memanggil `/api` di origin yang sama.

```
┌──────────────────────────────────────────────────────────────────┐
│  uvicorn app.main:app   →   http://127.0.0.1:8000                │
│                                                                  │
│  ── /api/* ────────────────────────────────────────────────────  │
│    app/api.py     rute JSON + skema pydantic + validasi          │
│    app/tax.py     engine pajak (murni, tanpa I/O)                │
│    app/db.py      satu-satunya penulis SQL                       │
│    app/util.py    parsing & format angka Indonesia                │
│    app/config.py  lokasi DB & folder hasil build                 │
│                                                                  │
│  ── /* ───────────────────────────────────────────────────────  │
│    web/dist  →  SPA React (index.html + /assets/*)               │
│    rute klien: /, /pendapatan, /setoran, /spt, /pengaturan       │
│    catch-all paling akhir: berkas statis bila ada, selain itu    │
│    index.html, dengan penjagaan agar tidak bisa keluar folder    │
│                                                                  │
│                        ▼                                         │
│                data/pajak.db (SQLite, 1 file)                    │
└──────────────────────────────────────────────────────────────────┘
```

Urutan pendaftaran rute menentukan siapa yang menang: `/api` dan `/assets` didaftarkan lebih
dulu, lalu `/{jalur:path}` sebagai catch-all terakhir. Karena itu `/docs` dan
`/openapi.json` bawaan FastAPI tetap hidup meski ada catch-all.

Selain satu proses, arah ketergantungan kode juga satu arah: UI tidak pernah menyentuh SQL,
dan API tidak pernah menyentuh render. Penghubungnya hanya JSON.

Saat mengembangkan, SPA boleh dijalankan terpisah (`npm run dev` di :5173 dengan proxy ke
:8000) supaya dapat hot-reload. Itu pilihan kenyamanan, bukan keharusan — tanpa dev server
pun aplikasi jalan utuh dari satu proses.

Batas tanggung jawab:

- **`tax.py` murni** — terima angka, kembalikan angka. Bisa diuji tanpa setup, tanpa DB.
- **`db.py`** satu-satunya penulis SQL.
- **`api.py`** tipis: HTTP + pydantic. Tidak ada aturan pajak di sini.
- **`kurs.py`** modul pengambil kurs KMK. **Sudah tidak dipakai** dan tidak diimpor di mana pun;
  disimpan hanya supaya tidak ada yang hilang kalau nanti butuh rujukan kurs lagi.
- **`legacy_ui.py`** UI lama (Jinja2). Tidak dipasang lagi di aplikasi utama, disimpan utuh
  supaya tidak ada yang hilang, dan masih diuji lewat `tests/test_app.py`. Belum ikut
  disesuaikan dengan penghapusan konversi valas, jadi jangan dipakai sebagai acuan perilaku.

## 5. Tumpukan teknologi & alasan

Bagian ini yang menjawab "pakai UI library yang bagus": mana yang dipakai dan kenapa.

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Komponen UI | **shadcn/ui** (Radix + Tailwind v4) | Kode komponen disalin ke repo, bukan black box. Aksesibilitas Radix sudah benar (fokus, keyboard, ARIA), jadi tidak perlu bikin ulang. |
| Styling | **Tailwind CSS v4** + `tw-animate-css` | Utility + token CSS variable; build cepat lewat `@tailwindcss/vite`. |
| Tabel data | **TanStack Table v9** | Sorting + filter di halaman Pendapatan. Headless, jadi markup tetap milik kita dan cocok dengan komponen `Table` shadcn. |
| Data server | **TanStack Query v5** | Cache, status loading/error/empty tanpa state manual, dan invalidasi otomatis setelah mutasi. |
| Form | **React Hook Form + Zod** | Validasi satu skema yang sama dipakai untuk pesan error per field; tanpa re-render berlebih. |
| Grafik | **Recharts** via `ChartContainer` shadcn | Grafik batang penghasilan per bulan; warna mengikuti token. |
| Toast | **Sonner** | Umpan balik setelah simpan/hapus. |
| Ikon | **Lucide** | Default shadcn. |
| Tema | **next-themes** | Terang/gelap, ikut preferensi sistem, tersimpan di localStorage. |
| Routing | **react-router** | 5 rute, tanpa server-side routing. |
| Font | **Geist Variable** | Angka rapi, skala tegas untuk tabel padat. |
| Backend | **FastAPI + pydantic v2** | Sudah dipakai; validasi skema deklaratif, dokumentasi OpenAPI otomatis. |
| Basis data | **SQLite** | Satu pengguna, satu mesin; backup = salin satu file. |

**Yang sengaja tidak dipakai: CodedVisuals.** Library itu katalog *ilustrasi animasi untuk
halaman marketing* (bento grid, hero, feature block) yang butuh React + Tailwind + shadcn
**plus lisensi berbayar**, dan setiap visualnya bersifat dekoratif (`aria-hidden`) — tidak
menyediakan tabel, form, atau komponen dashboard. Aplikasi ini adalah *product surface*
(alat kerja), bukan halaman kampanye, jadi tidak ada bagian yang cocok. Yang diadopsi dari
gagasan itu hanyalah **kosakata token shadcn** di bawah, supaya kalau nanti dibuat landing
page React, sisinya sudah nyambung.

## 6. Kontrak API

Semua endpoint di `/api`, JSON, divalidasi pydantic. Uang rupiah = integer (rupiah penuh).

| Metode | Jalur | Guna |
|---|---|---|
| GET | `/api/sehat` | Cek hidup |
| GET | `/api/tahun` | Daftar tahun pajak |
| GET/PUT | `/api/pengaturan` | Identitas, PTKP, mode & persen norma |
| GET/PUT | `/api/biaya?tahun=` | Biaya usaha (mode pembukuan) |
| GET | `/api/pendapatan?tahun=` | Daftar penerimaan |
| POST | `/api/pendapatan` | Tambah (201) |
| PUT | `/api/pendapatan/{id}` | Ubah |
| DELETE | `/api/pendapatan/{id}` | Hapus (204) |
| GET | `/api/setoran?tahun=` | Daftar setoran |
| POST | `/api/setoran` | Tambah (201) |
| DELETE | `/api/setoran/{id}` | Hapus (204) |
| GET | `/api/ringkasan?tahun=` | Semua angka siap-SPT + agregat bulan/sumber/bank |

Contoh ringkasan yang dikembalikan:

```json
{
  "tahun": "2026", "bruto": 294350000, "neto": 147175000,
  "ptkp": 54000000, "pkp": 93175000, "pph": 7976250, "kredit": 11500000,
  "kurang_bayar": -3523750, "pph25_bulanan": 664687,
  "mode": "norma", "norma_persen": 50.0, "status_ptkp": "TK/0",
  "rincian": [{ "dari": 0, "sampai": 60000000, "tarif": 0.05, "dasar": 60000000, "pajak": 3000000 }],
  "per_bulan": [20150000, 25300000, "..."],
  "per_bank": [{ "bank": "BCA", "total": 210050000, "jumlah_transaksi": 8 }]
}
```

**Satu keputusan penting di lapisan ini:** `kurang_bayar` bisa negatif (artinya lebih bayar)
dan itu diteruskan apa adanya ke frontend, bukan dipaksa positif. Frontend yang memutuskan
label dan warna. Angka Mentah lebih jujur daripada angka yang sudah ditafsirkan server.

## 7. Model data

`pendapatan` — sumber kebenaran basis pajak.

| Kolom | Tipe | Catatan |
|---|---|---|
| id | INTEGER PK | |
| tanggal | TEXT NOT NULL | `YYYY-MM-DD`, tanggal dana masuk |
| sumber | TEXT NOT NULL | nama klien/platform |
| **idr** | **INTEGER NOT NULL** | **jumlah rupiah yang masuk rekening — basis hitung** |
| bank | TEXT NULL | BCA/Mandiri |
| catatan | TEXT NULL | nomor referensi / berita transfer |
| dibuat | TEXT NOT NULL | waktu input |

Kolom era konversi valas (`mata_uang`, `jumlah_valas`, `kurs_kmk`) sudah **dihapus** dari
skema. Kalau database lama masih punya kolom itu, `init_db` membuangnya otomatis saat aplikasi
dibuka — baris datanya tidak hilang, hanya kolomnya yang dipotong (ada tesnya).

`setoran` (jenis, masa, jumlah) → kredit pajak. `biaya` (satu baris per tahun) untuk
pembukuan. `pengaturan` key/value.

Keputusan tipe: uang rupiah **INTEGER** (rupiah penuh) supaya tidak ada galat pembulatan
floating point; valas & kurs `REAL` karena memang pecahan.

**Konsekuensi threading:** koneksi SQLite dibuat satu per request dan dibuka dengan
`check_same_thread=False`. FastAPI menjalankan dependency dan endpoint sinkron di thread pool
yang bisa berbeda thread, jadi tanpa ini muncul error intermittent
`SQLite objects created in a thread can only be used in that same thread`. Koneksi tidak
pernah dibagi antar-request, jadi ini aman. Ada tes regresinya di `tests/test_api.py`.

## 8. Engine pajak

- `hitung_ptkp(status)` — TK/K, K/I (penghasilan istri digabung), tanggungan dibatasi 3.
- `hitung_neto(bruto, mode, norma, biaya)` — `norma`: persentase bruto; `pembukuan`:
  bruto − biaya, tidak pernah negatif.
- `hitung_pph(pkp)` — menelusuri 5 lapisan tarif dan mengembalikan **rincian per lapisan**,
  bukan cuma total, supaya bisa ditampilkan dan diaudit.
- `ringkasan_tahunan(...)` — merangkai semuanya sampai kurang/lebih bayar dan indikasi
  angsuran PPh 25 bulanan.

Aritmetika memakai `Decimal`, dibulatkan ke rupiah penuh di titik akhir.

Validasi silang yang sudah diuji: PKP Rp121 jt → Rp12.150.000 (5%×60jt + 15%×61jt), sama
dengan contoh perhitungan di panduan pajak.

## 9. Design token

Satu sumber: `web/src/index.css`. Tiga lapis, semua warna OKLCH, lengkap untuk **terang dan
gelap**:

1. **Semantik shadcn** (yang dipakai komponen): `--background`, `--foreground`, `--card`,
   `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`,
   `--border`, `--input`, `--ring`, `--radius`, `--sidebar-*`, `--chart-1..5`.
2. **Domain** (ditambahkan, dipetakan lewat `@theme inline` supaya jadi utility Tailwind):
   `--positive`, `--positive-soft`, `--negative`, `--negative-soft`, `--warning`,
   `--warning-soft`, `--warning-border`.
3. Skala di luar warna: radius (`--radius-sm…2xl` dari `--radius`), font (`Geist Variable`),
   dan spacing Tailwind bawaan (basis 4px).

Palet: kertas hangat (`oklch(0.984 0.008 80)`), tinta hangat, aksen **oker**
(`oklch(0.5 0.115 58)`) yang dipakai hemat — di `--ring` (fokus), `--chart-1`, dan token
domain. `--accent` shadcn sengaja dibiarkan lembut karena di shadcn token itu untuk
permukaan hover, bukan warna brand.

Aturan: **komponen tidak menulis nilai warna mentah.** Kalau butuh warna baru, tambahkan
token dulu. Efeknya: ganti tema = ganti satu blok CSS.

## 10. Pola UI per halaman

| Halaman | Sifat kerja | Komponen utama |
|---|---|---|
| Ringkasan | Monitor + Compare | `Card`, `StatCard`, `Alert`, `Progress`, `Table`, `ChartContainer`+Recharts; rekap per bank & per sumber |
| Pendapatan | Compare | `Input` pencarian, TanStack Table + `Table` shadcn, `Dialog` form (`Field`, `Input`, `Select`, `Textarea`), `DialogKonfirmasi` |
| Setoran | Compare + Monitor | `StatCard`, `Progress`, `Table`, `Dialog` form |
| SPT 1770 | Learn + Decide | `Alert` (kewajiban NPPN), `Card`, daftar bernomor, `Table` tenggat |
| Pengaturan | Configure | `Card`, `FieldGroup`, `Field`, `Select`, `Input`, `InputAngka` |

Detail yang dijaga:

- **Angka tidak pernah jadi input mentah.** `InputAngka` memformat ribuan gaya Indonesia
  sambil diketik dan menjaga posisi kursor; parsing ada di satu tempat (`lib/format.ts`).
- **States lengkap**: loading pakai `Skeleton`, kosong pakai `EmptyState` dengan ajakan aksi,
  error query ditampilkan sebagai pesan yang menyebut penyebabnya (server API belum jalan),
  bukan layar putih.
- **Ambil kurs KMK** memakai status `aria-busy` + spinner, dan hasilnya menjelaskan nomor KMK
  serta periodenya.
- **Hapus** selalu lewat dialog konfirmasi yang menyebut sumber, tanggal, dan nominal.

## 11. Alur kepatuhan Coretax (terverifikasi dari sumber resmi)

1. Pemberitahuan norma (bila pakai NPPN) ≤ 31 Maret.
2. Catat pendapatan sepanjang tahun.
3. SPT → Buat Konsep SPT → PPh Orang Pribadi → SPT Tahunan → Normal/Pembetulan.
4. Ikon pensil → **Posting** (sistem mengisi sendiri induk & lampiran) → periksa.
5. Sumber penghasilan: **Pekerjaan Bebas**; isi L2, L3, L1.
6. **Bayar dan Lapor** → penyedia penandatangan → tanda tangan digital → Simpan →
   Konfirmasi Tanda Tangan.
7. Status jadi *SPT Menunggu Pembayaran*; bayar via deposit atau kode billing (**kode billing
   diterbitkan otomatis** kalau lewat tombol ini — tidak perlu buat manual).
8. Setelah bayar → *SPT Dilaporkan*. BPE hanya dikirim ke **email**; kirim ulang lewat
   SPT → SPT Dilaporkan → ikon Email.

Kode billing mandiri (mis. PPh 25 bulanan): Pembayaran → Layanan Mandiri Kode Billing →
KAP + KJS → periode/tahun → nilai → unduh PDF. Masa aktif **14 hari**.

## 12. Keputusan & trade-off

| Keputusan | Alasan | Yang dikorbankan |
|---|---|---|
| Hapus konversi valas (mata uang, jumlah valas, kurs KMK) | Uangnya sudah masuk rekening dalam rupiah, jadi konversi hanya menambah kolom tanpa menambah kepastian. Input jadi secepat membaca mutasi rekening | Tidak ada lagi pembanding kurs KMK resmi; bukti transfer bank jadi satu-satunya rujukan kalau ditanya |
| Engine pajak tetap Python | Sudah teruji & rumusnya sudah dicocokkan ke panduan resmi; menulis ulang ke TS berarti mengulang validasi | Dua bahasa dalam satu repo |
| Monolith satu proses, bukan frontend + backend terpisah | Satu perintah jalan, satu port, tanpa CORS; engine Python tetap dipakai dan API-nya masih bisa dipakai klien lain (script, CLI, mobile) | UI tidak punya hot-reload kecuali menjalankan dev server Vite secara opsional |
| shadcn (salin kode) bukan paket komponen | Komponen jadi milik repo, bisa diubah tanpa menunggu upstream; aksesibilitas Radix tetap dapat | Lebih banyak file di repo |
| Tailwind v4 + CSS variable, bukan CSS-in-JS | Token hidup di CSS, jadi tema terang/gelap cuma ganti blok variabel | Kelas utility panjang di JSX |
| Basis hitung = IDR rekening | Angka riil yang dipegang wajib pajak, mudah dipertanggungjawabkan | Perlu disiplin mencatat dari mutasi rekening |
| `useTable` v9 + fitur eksplisit | Hanya fitur yang dipakai yang ikut (sorting + global filter), bundle lebih kecil | API v9 masih baru, contoh v8 di internet tidak cocok |

## 13. Keamanan & privasi

- Satu proses menyajikan SPA dan API di `127.0.0.1`. **Jangan** diekspos ke jaringan publik
  tanpa menambah autentikasi.
- Tidak ada CORS: SPA dan API satu origin, jadi browser tidak perlu izin lintas asal.
- Catch-all SPA dijaga agar tidak bisa membaca berkas di luar `web/dist` (sudah diuji dengan
  percobaan path traversal).
- Tidak ada panggilan jaringan keluar sama sekali. Aplikasi berjalan sepenuhnya lokal.
- Tidak ada analitik, telemetri, atau data keluar ke pihak ketiga.
- SQL selalu berparameter; output di-escape oleh Jinja2 (UI lama) dan React (SPA).

## 14. Uji

```bash
# backend
python3 -m unittest discover -s tests -v

# frontend (typecheck + build)
cd web && npm run build
```

83 tes backend:

- `test_tax.py` — PTKP, norma, PKP, tiap lapisan tarif, mode pembukuan, kasus batas.
- `test_db.py` — CRUD, agregasi per tahun/bulan/sumber/bank, upsert, daftar tahun, **plus tes
  migrasi** (database lama dengan kolom valas dibuang kolomnya tapi barisnya utuh).
- `test_util.py` — parser angka format Indonesia.
- `test_kurs.py` — parser tabel kurs dari HTML contoh, kasus mata uang tak ada.
- `test_api.py` — kontrak API: CRUD, validasi ditolak (422), 404, bentuk ringkasan,
  penandaan selisih kurs, **plus tes regresi konkurensi koneksi SQLite**.
- `test_app.py` — UI lama (`legacy_ui.py`), yang kini tidak dipasang di aplikasi utama.

Typecheck frontend lewat `tsc -b` ikut jalan di `npm run build`. Tipe TanStack Table v9
membantu menangkap kesalahan konfigurasi fitur (mis. `globalFilteringFeature` menuntut
`columnFilteringFeature`) sebelum kode dijalankan.

## 15. Di luar cakupan / rencana berikutnya

1. Menghapus UI lama (`app/legacy_ui.py`, `app/templates`, `app/static`) dan `app/kurs.py` —
   sudah tidak dipasang/dipakai, tinggal dibersihkan.
2. Impor mutasi rekening (BCA/Mandiri) — alur kerjanya memang dari situ, jadi ini kandidat
   peningkatan paling berguna berikutnya.
3. Code-splitting bundle (`recharts` penyumbang terbesar; saat ini ~1 MB, 313 KB gzip).
4. Kredit pajak luar negeri (PPh 24) per negara + batas kredit.
5. Modul PPN bila nanti jadi PKP.
6. Ekspor rekap tahunan ke CSV/PDF untuk arsip.

## 16. Catatan

Alat bantu hitung, bukan nasihat pajak. Angka mengikuti ketentuan yang berlaku saat dokumen
ini ditulis; sebelum lapor resmi, cocokkan dengan ketentuan terbaru dan konsultan pajak atau
AR di KPP.
