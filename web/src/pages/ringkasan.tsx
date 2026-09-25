import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
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
import { BULAN_SINGKAT, persen, rupiah } from '@/lib/format'
import { useRingkasan } from '@/lib/query'
import { useTahunAktif } from '@/lib/tahun'
import { Link } from 'react-router-dom'

const konfigurasiGrafik = {
  bruto: { label: 'Penghasilan', color: 'var(--chart-1)' },
} satisfies ChartConfig

export default function HalamanRingkasan() {
  const { tahun } = useTahunAktif()
  const { data, isLoading, isError } = useRingkasan(tahun)

  if (isLoading) {
    return (
      <>
        <PageHeader judul={`Ringkasan ${tahun}`} lede="Perkiraan PPh tahun berjalan." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-lg" />
      </>
    )
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader judul={`Ringkasan ${tahun}`} lede="Perkiraan PPh tahun berjalan." />
        <Alert variant="destructive">
          <AlertTitle>Tidak bisa memuat data</AlertTitle>
          <AlertDescription>
            Pastikan server API (uvicorn) sedang jalan di port 8000, lalu muat ulang halaman.
          </AlertDescription>
        </Alert>
      </>
    )
  }

  const persenSetor = data.pph > 0 ? (data.kredit / data.pph) * 100 : 0
  const kurangBayar = data.kurang_bayar
  const dataGrafik = data.per_bulan.map((nilai, i) => ({ bulan: BULAN_SINGKAT[i], bruto: nilai }))

  return (
    <>
      <PageHeader
        judul={`Ringkasan ${tahun}`}
        lede="Perkiraan PPh tahun berjalan, dihitung dari rupiah yang benar-benar masuk rekening."
        aksi={
          <Button asChild>
            <Link to="/pendapatan">Catat pendapatan</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          utama
          label="Penghasilan bruto"
          nilai={rupiah(data.bruto)}
          keterangan={`Jumlah masuk rekening, ${tahun}`}
        />
        <StatCard
          label="Estimasi PPh terutang"
          nilai={rupiah(data.pph)}
          keterangan="Tarif progresif Pasal 17"
        />
        <StatCard
          label="Sudah disetor"
          nilai={rupiah(data.kredit)}
          keterangan={`${data.setoran_jumlah} transaksi`}
        />
        {kurangBayar >= 0 ? (
          <StatCard
            label="Kurang bayar"
            nilai={rupiah(kurangBayar)}
            keterangan="Perkiraan, belum final"
            nada="negatif"
          />
        ) : (
          <StatCard
            label="Lebih bayar"
            nilai={rupiah(-kurangBayar)}
            keterangan="Perkiraan, belum final"
            nada="positif"
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perhitungan PPh</CardTitle>
          <CardDescription>
            {data.mode === 'norma'
              ? `Norma ${data.norma_persen}% dari bruto`
              : 'Pembukuan: bruto dikurangi biaya usaha'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="flex flex-col text-sm">
            <Baris label="Penghasilan bruto (jumlah masuk rekening)" nilai={rupiah(data.bruto)} />
            {data.mode === 'pembukuan' ? (
              <>
                <Baris label="Biaya usaha" nilai={`− ${rupiah(data.biaya)}`} />
                <Baris label="Penghasilan neto" nilai={rupiah(data.neto)} />
              </>
            ) : (
              <Baris
                label={`Penghasilan neto (${data.norma_persen}% × bruto)`}
                nilai={rupiah(data.neto)}
              />
            )}
            <Baris label={`PTKP ${data.status_ptkp}`} nilai={`− ${rupiah(data.ptkp)}`} />
            <Baris label="Penghasilan Kena Pajak (PKP)" nilai={rupiah(data.pkp)} />
            <Baris label="PPh terutang" nilai={rupiah(data.pph)} />
            <Baris label="Kredit pajak (sudah disetor)" nilai={`− ${rupiah(data.kredit)}`} />
            <Baris
              label={kurangBayar < 0 ? 'Lebih bayar' : 'Kurang bayar'}
              nilai={rupiah(Math.abs(kurangBayar))}
              tegaskan
              nada={kurangBayar < 0 ? 'positif' : 'negatif'}
            />
          </dl>

          {data.pph > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Porsi setoran</span>
                <span>{persen(persenSetor, 1)} dari estimasi PPh</span>
              </div>
              <Progress value={Math.min(persenSetor, 100)} />
            </div>
          ) : null}

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
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Penghasilan per bulan</CardTitle>
            <CardDescription>Total {rupiah(data.bruto)}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.bruto > 0 ? (
              <ChartContainer config={konfigurasiGrafik} className="h-[220px] w-full">
                <BarChart data={dataGrafik} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bulan" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(nilai) => rupiah(Number(nilai))} />}
                  />
                  <Bar dataKey="bruto" fill="var(--color-bruto)" radius={3} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground py-10 text-center text-sm">
                Belum ada penghasilan tercatat di {tahun}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per bank</CardTitle>
            <CardDescription>{data.per_bank.length} rekening</CardDescription>
          </CardHeader>
          <CardContent>
            {data.per_bank.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Transaksi</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.per_bank.map((b) => (
                    <TableRow key={b.bank}>
                      <TableCell className="font-medium">{b.bank}</TableCell>
                      <TableCell className="text-right">{b.jumlah_transaksi}</TableCell>
                      <TableCell className="text-right">{rupiah(b.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground py-10 text-center text-sm">Belum ada data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per sumber</CardTitle>
          <CardDescription>{data.per_sumber.length} sumber</CardDescription>
        </CardHeader>
        <CardContent>
          {data.per_sumber.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sumber</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.per_sumber.map((s) => (
                  <TableRow key={s.sumber}>
                    <TableCell className="max-w-[280px] truncate font-medium">{s.sumber}</TableCell>
                    <TableCell className="text-right">{s.jumlah_transaksi}</TableCell>
                    <TableCell className="text-right">{rupiah(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">Belum ada data.</p>
          )}
        </CardContent>
      </Card>

      {data.bruto === 0 ? (
        <Card>
          <EmptyState
            judul={`Belum ada penghasilan tercatat untuk ${tahun}`}
            pesan="Mulai dari satu penerimaan: tanggal uang masuk, dari klien mana, berapa dolar yang dikirim, dan berapa rupiah yang benar-benar masuk rekening."
            aksi={
              <Button asChild>
                <Link to="/pendapatan">Catat pendapatan pertama</Link>
              </Button>
            }
          />
        </Card>
      ) : null}
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
            : 'font-medium'
        }
      >
        {nilai}
      </dd>
    </div>
  )
}
