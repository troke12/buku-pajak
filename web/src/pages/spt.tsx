import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { InputAngka } from '@/components/input-angka'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { angka, parseAngka, rupiah } from '@/lib/format'
import { useBiaya, useRingkasan, useSimpanBiaya } from '@/lib/query'
import { useTahunAktif } from '@/lib/tahun'

export default function HalamanSpt() {
  const { tahun } = useTahunAktif()
  const { data, isLoading } = useRingkasan(tahun)
  const { data: biaya } = useBiaya(tahun)
  const simpanBiaya = useSimpanBiaya(tahun)

  const [nilaiBiaya, setNilaiBiaya] = useState('')
  const [catatanBiaya, setCatatanBiaya] = useState('')

  useEffect(() => {
    if (biaya) setNilaiBiaya(biaya.jumlah ? angka(biaya.jumlah, 0) : '')
  }, [biaya])

  if (isLoading || !data) {
    return (
      <>
        <PageHeader judul={`SPT 1770 ${tahun}`} lede="Angka siap dipindah ke Coretax." />
        <Skeleton className="h-[420px] rounded-lg" />
      </>
    )
  }

  const kurangBayar = data.kurang_bayar
  const tanggalLapor = String(Number(tahun) + 1)

  async function simpan() {
    try {
      await simpanBiaya.mutateAsync({
        tahun,
        jumlah: Math.round(parseAngka(nilaiBiaya)),
        catatan: catatanBiaya,
      })
      toast.success('Biaya usaha tersimpan')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    }
  }

  return (
    <>
      <PageHeader
        judul={`SPT 1770 ${tahun}`}
        lede="Angka siap dipindah ke Coretax, plus urutan pelaporannya. Cek ulang sebelum submit."
      />

      {data.mode === 'norma' ? (
        <Alert className="border-warning-border bg-warning-soft text-warning">
          <AlertTriangle />
          <AlertTitle>Pemberitahuan pemakaian norma (NPPN) wajib paling lambat 31 Maret {tahun}</AlertTitle>
          <AlertDescription className="text-foreground/80">
            Yaitu tiga bulan pertama tahun pajak, disampaikan lewat layanan pemberitahuan norma di
            Coretax. Kalau tidak disampaikan, lo dianggap memilih <em>pembukuan</em> dan norma tidak
            boleh dipakai. Kewajiban lain: menyelenggarakan pencatatan (halaman Pendapatan ini sudah
            jadi catatannya) dan omzet gabungan satu keluarga tidak melebihi Rp4,8 miliar.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lampiran L2 — penghasilan dari pekerjaan bebas</CardTitle>
          <CardDescription>
            {data.mode === 'norma' ? 'Pencatatan / NPPN' : 'Pembukuan'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col text-sm">
            <Baris label="Penghasilan bruto setahun" nilai={rupiah(data.bruto)} />
            {data.mode === 'norma' ? (
              <Baris label={`Norma (${data.norma_persen}%)`} nilai={rupiah(data.neto)} />
            ) : (
              <>
                <Baris label="Biaya usaha" nilai={`− ${rupiah(data.biaya)}`} />
                <Baris label="Penghasilan neto" nilai={rupiah(data.neto)} />
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Induk — penghasilan neto &amp; PPh terutang</CardTitle>
          <CardDescription>Rumus resmi DJP</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="flex flex-col text-sm">
            <Baris label="Penghasilan neto" nilai={rupiah(data.neto)} />
            <Baris label={`PTKP (${data.status_ptkp})`} nilai={`− ${rupiah(data.ptkp)}`} />
            <Baris label="Penghasilan Kena Pajak" nilai={rupiah(data.pkp)} />
            <Baris label="PPh terutang" nilai={rupiah(data.pph)} />
            <Baris label="Kredit pajak" nilai={`− ${rupiah(data.kredit)}`} />
            <Baris
              tegaskan
              nada={kurangBayar < 0 ? 'positif' : 'negatif'}
              label={
                kurangBayar < 0 ? 'PPh lebih bayar (Pasal 28A)' : 'PPh kurang bayar (Pasal 29)'
              }
              nilai={rupiah(Math.abs(kurangBayar))}
            />
          </dl>

          {data.rincian.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lapisan PKP</TableHead>
                    <TableHead className="text-right">Dasar</TableHead>
                    <TableHead className="text-right">Tarif</TableHead>
                    <TableHead className="text-right">PPh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rincian.map((r) => (
                    <TableRow key={r.dari}>
                      <TableCell>
                        {rupiah(r.dari)} — {r.sampai ? rupiah(r.sampai) : 'ke atas'}
                      </TableCell>
                      <TableCell className="text-right">{rupiah(r.dasar)}</TableCell>
                      <TableCell className="text-right">{r.tarif * 100}%</TableCell>
                      <TableCell className="text-right">{rupiah(r.pajak)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Total PPh terutang</TableCell>
                    <TableCell className="text-right">{rupiah(data.pph)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Urutan hitung mengikuti panduan resmi: bruto × norma = neto; neto − PTKP = PKP; PKP ×
            tarif Pasal 17 = PPh terutang; dikurangi kredit pajak = kurang atau lebih bayar.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kredit pajak</CardTitle>
            <CardDescription>Total {rupiah(data.kredit)}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.setoran_jenis.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.setoran_jenis.map((s) => (
                    <TableRow key={s.jenis}>
                      <TableCell>{s.jenis}</TableCell>
                      <TableCell className="text-right">{rupiah(s.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">
                Belum ada setoran. PPh kurang bayar dilunasi lewat tombol Bayar dan Lapor di Coretax;
                sistem akan menerbitkan kode billing sendiri.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {data.mode === 'pembukuan' ? (
        <Card>
          <CardHeader>
            <CardTitle>Biaya usaha {tahun}</CardTitle>
            <CardDescription>Hanya dipakai kalau memilih pembukuan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="biaya" className="text-sm font-medium">
                Total biaya usaha (3M)
              </label>
              <InputAngka
                id="biaya"
                placeholder="0"
                value={nilaiBiaya}
                onValueChange={setNilaiBiaya}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="catatan-biaya" className="text-sm font-medium">
                Catatan
              </label>
              <Input
                id="catatan-biaya"
                placeholder="Mis. perangkat, langganan, internet"
                value={catatanBiaya}
                onChange={(e) => setCatatanBiaya(e.target.value)}
              />
            </div>
            <Button onClick={simpan} disabled={simpanBiaya.isPending}>
              {simpanBiaya.isPending ? <Loader2 className="animate-spin" /> : null}
              Simpan biaya
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Urutan lapor lewat Coretax DJP</CardTitle>
          <CardDescription>Sesuai panduan resmi Coretaxpedia</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {[
              `Pastikan semua penerimaan ${tahun} sudah tercatat, dan pemberitahuan norma (bila pakai NPPN) sudah disampaikan paling lambat 31 Maret ${tahun}.`,
              'Buka menu Surat Pemberitahuan (SPT) → Surat Pemberitahuan (SPT) → Buat Konsep SPT, pilih PPh Orang Pribadi, lalu Lanjut.',
              'Pilih SPT Tahunan, isi periode dan tahun pajak, lalu pilih model Normal (pelaporan pertama) atau Pembetulan.',
              'Klik Buat Konsep SPT, lalu ikon pensil untuk mulai mengisi formulir.',
              'Klik Posting: sistem akan mengisi sendiri sebagian besar formulir induk dan lampiran. Periksa dan perbaiki sesuai angka di halaman ini.',
              'Pada formulir induk, pilih sumber penghasilan Pekerjaan Bebas, isi Lampiran L2, lengkapi L3 (penghasilan lain) dan L1 (harta, utang, tanggungan) bila ada.',
              'Klik Bayar dan Lapor, pilih penyedia penandatangan, lalu isi tanda tangan digital (ID dan kata sandi) untuk validasi.',
              'Klik Simpan lalu Konfirmasi Tanda Tangan. SPT kurang bayar akan pindah ke status SPT Menunggu Pembayaran.',
              'Bayar lewat deposit atau kode billing. Kalau lewat tombol Bayar dan Lapor, kode billing dibuat otomatis, tidak perlu bikin manual. Setelah pembayaran berhasil, SPT otomatis pindah ke SPT Dilaporkan.',
              'Cek BPE. Bukti Penerimaan Elektronik dikirim ke email, bukan file PDF, dan tidak muncul di menu Dokumen Saya. Kalau email tidak masuk, buka SPT → SPT Dilaporkan → ikon Email untuk kirim ulang.',
            ].map((teks, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {i + 1}
                </span>
                <span>{teks}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kode billing &amp; pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="flex flex-col text-sm">
              <Baris label="Buat kode billing mandiri" nilai="Pembayaran → Layanan Mandiri Kode Billing" />
              <Baris label="Yang dipilih" nilai="KAP dan KJS" />
              <Baris label="Jumlah digit kode billing" nilai="15 digit" />
              <Baris label="Masa aktif kode billing" nilai="14 hari / 336 jam" />
            </dl>
            <p className="text-muted-foreground text-xs">
              Masa aktif 14 hari mengacu Pengumuman Dirjen Pajak PENG-4/PJ/2025 (sebelumnya 7 hari).
              Kalau kedaluwarsa, kode billing harus dibuat ulang; kalau berasal dari pelaporan SPT,
              status SPT kembali jadi Konsep SPT. Kode billing yang dibuat sistem dari tombol Bayar
              dan Lapor dicek di Pembayaran → Daftar Kode Billing Belum Dibayar atau Portal Saya →
              Dokumen Saya (dokumen “Billing Code”).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenggat &amp; sanksi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kewajiban</TableHead>
                  <TableHead>Batas waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Pemberitahuan pemakaian norma (NPPN)</TableCell>
                  <TableCell className="whitespace-nowrap">31 Maret {tahun}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Setor angsuran PPh Pasal 25</TableCell>
                  <TableCell className="whitespace-nowrap">Tanggal 15 bulan berikutnya</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Lapor SPT Tahunan Orang Pribadi</TableCell>
                  <TableCell className="whitespace-nowrap">31 Maret {tanggalLapor}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Masa aktif kode billing</TableCell>
                  <TableCell className="whitespace-nowrap">14 hari sejak diterbitkan</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Separator />
            <p className="text-muted-foreground text-xs">
              Telat lapor SPT Tahunan OP dikenai denda Rp 100.000. Telat setor kena bunga sesuai tarif
              yang berlaku. Angsuran PPh Pasal 25 tahun berjalan mengacu ke PPh terutang tahun
              sebelumnya, jadi angka yang wajar disisihkan sekitar {rupiah(data.pph25_bulanan)} per
              bulan.
            </p>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertTriangle />
        <AlertTitle>Ini alat bantu hitung, bukan nasihat pajak</AlertTitle>
        <AlertDescription>
          Sejak PP 20/2026, penghasilan pekerjaan bebas tidak lagi bisa pakai PPh Final UMKM 0,5%,
          jadi dasar hitungnya tarif progresif dengan norma atau pembukuan. Kalau lo mempekerjakan
          orang lain dan tidak lagi bekerja sendiri, kategorinya bisa berubah jadi penghasilan usaha.
          Untuk keputusan resmi, cocokkan dengan ketentuan terbaru dan konsultan pajak atau AR di KPP.
        </AlertDescription>
      </Alert>
    </>
  )
}

function Baris({
  label,
  nilai,
  tegaskan = false,
  nada,
}: {
  label: string
  nilai: string
  tegaskan?: boolean
  nada?: 'positif' | 'negatif'
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed py-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          tegaskan
            ? nada === 'positif'
              ? 'text-positive font-semibold'
              : 'text-negative font-semibold'
            : 'text-right font-medium'
        }
      >
        {nilai}
      </dd>
    </div>
  )
}
