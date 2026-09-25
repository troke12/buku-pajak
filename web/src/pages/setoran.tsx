import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { DialogKonfirmasi } from '@/components/dialog-konfirmasi'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { DialogSetoran } from '@/components/setoran-form-dialog'
import { StatCard } from '@/components/stat-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
import type { Setoran } from '@/lib/api'
import { persen, rupiah } from '@/lib/format'
import { useHapusSetoran, useRingkasan, useSetoran } from '@/lib/query'
import { useTahunAktif } from '@/lib/tahun'

export default function HalamanSetoran() {
  const { tahun } = useTahunAktif()
  const { data: daftar = [], isLoading } = useSetoran(tahun)
  const { data: ringkas } = useRingkasan(tahun)
  const hapus = useHapusSetoran(tahun)

  const [dialogBuka, setDialogBuka] = useState(false)
  const [akanDihapus, setAkanDihapus] = useState<Setoran | null>(null)

  const total = daftar.reduce((jumlah, s) => jumlah + s.jumlah, 0)
  const target = ringkas?.pph ?? 0
  const persenTarget = target > 0 ? (total / target) * 100 : 0
  const selisih = total - target

  async function konfirmasiHapus() {
    if (!akanDihapus) return
    try {
      await hapus.mutateAsync(akanDihapus.id)
      toast.success('Setoran dihapus')
      setAkanDihapus(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus')
    }
  }

  return (
    <>
      <PageHeader
        judul={`Setoran pajak ${tahun}`}
        lede="Catat setiap pembayaran pajak (kode billing / e-billing) supaya jadi kredit pajak saat lapor SPT."
        aksi={
          <Button onClick={() => setDialogBuka(true)}>
            <Plus />
            Catat setoran
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Total disetor ${tahun}`}
          nilai={rupiah(total)}
          keterangan={`${daftar.length} transaksi`}
        />
        <StatCard
          label="Estimasi PPh terutang"
          nilai={rupiah(target)}
          keterangan="Dari halaman ringkasan"
        />
        <StatCard
          label={selisih > 0 ? 'Lebih bayar' : 'Sisa kurang bayar'}
          nilai={rupiah(Math.abs(selisih))}
          keterangan="Perkiraan, belum final"
          nada={selisih > 0 ? 'positif' : 'negatif'}
        />
      </div>

      {target > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Porsi setoran terhadap estimasi PPh</span>
              <span>{persen(persenTarget, 1)}</span>
            </div>
            <Progress value={Math.min(persenTarget, 100)} />
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-[280px] rounded-lg" />
      ) : daftar.length === 0 ? (
        <Card>
          <EmptyState
            judul="Belum ada setoran tercatat"
            pesan="Setiap kali bayar pajak lewat kode billing, catat di sini. Angkanya dipakai sebagai kredit pajak di SPT dan biar kelihatan sisa kurang bayarnya."
            aksi={
              <Button onClick={() => setDialogBuka(true)}>
                <Plus />
                Catat setoran
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Masa pajak</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">{s.tanggal}</TableCell>
                    <TableCell className="font-medium">{s.jenis}</TableCell>
                    <TableCell className="whitespace-nowrap">{s.masa ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {rupiah(s.jumlah)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[240px] truncate text-xs">
                      {s.catatan ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setAkanDihapus(s)}
                      >
                        <Trash2 className="size-3.5" />
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total {tahun}</TableCell>
                  <TableCell className="text-right font-semibold">{rupiah(total)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </Card>
      )}

      <DialogSetoran buka={dialogBuka} onBukaBerubah={setDialogBuka} tahun={tahun} />

      <DialogKonfirmasi
        buka={Boolean(akanDihapus)}
        onBukaBerubah={(b) => {
          if (!b) setAkanDihapus(null)
        }}
        judul="Hapus setoran ini?"
        pesan={
          akanDihapus
            ? `${akanDihapus.jenis} sebesar ${rupiah(akanDihapus.jumlah)} tanggal ${akanDihapus.tanggal}. Tindakan ini tidak bisa dibatalkan.`
            : ''
        }
        sibuk={hapus.isPending}
        onKonfirmasi={konfirmasiHapus}
      />
    </>
  )
}
