import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { ArrowUpDown, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { DialogKonfirmasi } from '@/components/dialog-konfirmasi'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { DialogPendapatan } from '@/components/pendapatan-form-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import type { Pendapatan } from '@/lib/api'
import { rupiah } from '@/lib/format'
import { useHapusPendapatan, usePendapatan } from '@/lib/query'
import { useTahunAktif } from '@/lib/tahun'

const fitur = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
})

const helper = createColumnHelper<typeof fitur, Pendapatan>()

const DATA_KOSONG: Pendapatan[] = []

export default function HalamanPendapatan() {
  const { tahun } = useTahunAktif()
  const { data, isLoading, isError } = usePendapatan(tahun)
  const hapus = useHapusPendapatan(tahun)

  const [dialogBuka, setDialogBuka] = useState(false)
  const [sedangDiubah, setSedangDiubah] = useState<Pendapatan | null>(null)
  const [akanDihapus, setAkanDihapus] = useState<Pendapatan | null>(null)

  const daftar = data ?? DATA_KOSONG

  const kolom = useMemo(
    () =>
      helper.columns([
        helper.accessor('tanggal', {
          header: ({ column }) => (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8"
              onClick={column.getToggleSortingHandler()}
            >
              Tanggal
              <ArrowUpDown className="size-3.5" />
            </Button>
          ),
          cell: (info) => <span className="whitespace-nowrap">{info.getValue()}</span>,
        }),
        helper.accessor('sumber', {
          header: 'Sumber / klien',
          cell: (info) => (
            <div className="flex flex-col">
              <span className="max-w-[240px] truncate font-medium">{info.getValue()}</span>
              {info.row.original.catatan ? (
                <span className="text-muted-foreground max-w-[240px] truncate text-xs">
                  {info.row.original.catatan}
                </span>
              ) : null}
            </div>
          ),
        }),
        helper.accessor('idr', {
          header: ({ column }) => (
            <div className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="-mr-3 h-8"
                onClick={column.getToggleSortingHandler()}
              >
                Jumlah masuk rekening
                <ArrowUpDown className="size-3.5" />
              </Button>
            </div>
          ),
          cell: (info) => (
            <div className="text-right font-medium whitespace-nowrap">{rupiah(info.getValue())}</div>
          ),
        }),
        helper.display({
          id: 'bank',
          header: () => <div className="text-right">Bank</div>,
          cell: ({ row }) => (
            <div className="text-right whitespace-nowrap">{row.original.bank ?? '—'}</div>
          ),
        }),
        helper.display({
          id: 'aksi',
          header: () => <div className="text-right">Aksi</div>,
          cell: ({ row }) => (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSedangDiubah(row.original)
                  setDialogBuka(true)
                }}
              >
                <Pencil className="size-3.5" />
                <span className="sr-only sm:not-sr-only">Ubah</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setAkanDihapus(row.original)}
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only sm:not-sr-only">Hapus</span>
              </Button>
            </div>
          ),
        }),
      ]),
    [],
  )

  const table = useTable({ features: fitur, columns: kolom, data: daftar })
  const total = daftar.reduce((jumlah, p) => jumlah + p.idr, 0)
  const filter = (table.state.globalFilter as string | undefined) ?? ''

  function bukaTambah() {
    setSedangDiubah(null)
    setDialogBuka(true)
  }

  async function konfirmasiHapus() {
    if (!akanDihapus) return
    try {
      await hapus.mutateAsync(akanDihapus.id)
      toast.success('Pendapatan dihapus')
      setAkanDihapus(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus')
    }
  }

  return (
    <>
      <PageHeader
        judul={`Pendapatan ${tahun}`}
        lede="Satu baris untuk setiap penerimaan. Angka yang dipakai untuk pajak adalah kolom IDR masuk rekening."
        aksi={
          <Button onClick={bukaTambah}>
            <Plus />
            Catat pendapatan
          </Button>
        }
      />

      {isError ? (
        <Card className="p-6 text-sm">
          Tidak bisa memuat data. Pastikan server API berjalan di port 8000.
        </Card>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-[320px] rounded-lg" />
      ) : daftar.length === 0 ? (
        <Card>
          <EmptyState
            judul={`Belum ada pendapatan di ${tahun}`}
            pesan="Catat tiap penerimaan begitu uangnya masuk rekening. Kolom IDR diisi angka yang benar-benar masuk, bukan hasil hitungan sendiri."
            aksi={
              <Button onClick={bukaTambah}>
                <Plus />
                Catat pendapatan
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="relative w-full sm:w-72">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Cari sumber atau catatan…"
                aria-label="Cari pendapatan"
                value={filter}
                onChange={(e) => table.setGlobalFilter(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground text-sm">
              {table.getRowModel().rows.length} dari {daftar.length} penerimaan · total {rupiah(total)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((grup) => (
                  <TableRow key={grup.id}>
                    {grup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap">
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={kolom.length} className="text-muted-foreground h-24 text-center">
                      Tidak ada data yang cocok dengan pencarian.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getAllCells().map((cell) => (
                        <TableCell key={cell.id}>
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total {tahun}</TableCell>
                  <TableCell className="text-right font-semibold">{rupiah(total)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </Card>
      )}

      <DialogPendapatan
        buka={dialogBuka}
        onBukaBerubah={(b) => {
          setDialogBuka(b)
          if (!b) setSedangDiubah(null)
        }}
        tahun={tahun}
        awal={sedangDiubah}
      />

      <DialogKonfirmasi
        buka={Boolean(akanDihapus)}
        onBukaBerubah={(b) => {
          if (!b) setAkanDihapus(null)
        }}
        judul="Hapus penerimaan ini?"
        pesan={
          akanDihapus
            ? `${akanDihapus.sumber} tanggal ${akanDihapus.tanggal} sebesar ${rupiah(akanDihapus.idr)}. Tindakan ini tidak bisa dibatalkan.`
            : ''
        }
        sibuk={hapus.isPending}
        onKonfirmasi={konfirmasiHapus}
      />
    </>
  )
}
