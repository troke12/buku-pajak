import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { InputAngka } from '@/components/input-angka'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { angka, parseAngka } from '@/lib/format'
import { STATUS_PTKP } from '@/lib/konstanta'
import { usePengaturan, useSimpanPengaturan } from '@/lib/query'
import { useTahunAktif } from '@/lib/tahun'

const skema = z.object({
  nama: z.string(),
  npwp: z.string(),
  status_ptkp: z.string(),
  mode_hitung: z.enum(['norma', 'pembukuan']),
  norma_persen: z
    .string()
    .refine((v) => parseAngka(v) > 0 && parseAngka(v) <= 100, 'Harus antara 0 dan 100'),
  bank_default: z.string(),
})

type NilaiForm = z.infer<typeof skema>

export default function HalamanPengaturan() {
  const { tahun } = useTahunAktif()
  const { data, isLoading } = usePengaturan()
  const simpan = useSimpanPengaturan()

  const form = useForm<NilaiForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: '',
      npwp: '',
      status_ptkp: 'TK/0',
      mode_hitung: 'norma',
      norma_persen: '50',
      bank_default: 'BCA',
    },
  })

  useEffect(() => {
    if (!data) return
    form.reset({
      nama: data.nama,
      npwp: data.npwp,
      status_ptkp: data.status_ptkp,
      mode_hitung: data.mode_hitung,
      norma_persen: angka(data.norma_persen, 0),
      bank_default: data.bank_default,
    })
  }, [data, form])

  const mode = form.watch('mode_hitung')

  async function kirim(nilai: NilaiForm) {
    try {
      await simpan.mutateAsync({
        nama: nilai.nama.trim(),
        npwp: nilai.npwp.trim(),
        status_ptkp: nilai.status_ptkp,
        mode_hitung: nilai.mode_hitung,
        norma_persen: parseAngka(nilai.norma_persen),
        bank_default: nilai.bank_default.trim(),
      })
      toast.success('Pengaturan tersimpan')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    }
  }

  return (
    <>
      <PageHeader
        judul="Pengaturan"
        lede="Identitas dan cara hitung. Perubahan langsung dipakai di halaman ringkasan dan SPT."
      />

      {isLoading ? (
        <Skeleton className="h-[420px] rounded-lg" />
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Identitas &amp; metode</CardTitle>
            <CardDescription>Semua data disimpan lokal di satu file SQLite.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(kirim)} noValidate>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="nama">Nama wajib pajak</FieldLabel>
                    <Input id="nama" placeholder="Nama sesuai NPWP" {...form.register('nama')} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="npwp">NPWP / NIK</FieldLabel>
                    <Input id="npwp" placeholder="16 digit" {...form.register('npwp')} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="status_ptkp">Status PTKP</FieldLabel>
                    <Controller
                      control={form.control}
                      name="status_ptkp"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="status_ptkp" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_PTKP.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldDescription>
                      TK = tidak kawin, K = kawin, K/I = penghasilan istri digabung.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="bank_default">Bank default</FieldLabel>
                    <Input
                      id="bank_default"
                      placeholder="BCA / Mandiri"
                      {...form.register('bank_default')}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="mode_hitung">Metode hitung</FieldLabel>
                    <Controller
                      control={form.control}
                      name="mode_hitung"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="mode_hitung" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="norma">Norma (NPPN)</SelectItem>
                            <SelectItem value="pembukuan">Pembukuan</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldDescription>
                      Pembukuan butuh input biaya usaha di halaman SPT.
                    </FieldDescription>
                  </Field>

                  <Field data-invalid={Boolean(form.formState.errors.norma_persen)}>
                    <FieldLabel htmlFor="norma_persen">Persentase norma</FieldLabel>
                    <Controller
                      control={form.control}
                      name="norma_persen"
                      render={({ field }) => (
                        <InputAngka
                          id="norma_persen"
                          desimal
                          disabled={mode !== 'norma'}
                          aria-invalid={Boolean(form.formState.errors.norma_persen)}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                    <FieldDescription>
                      Tenaga ahli umumnya 50%. Cek PER-17/PJ/2015 untuk profesi &amp; wilayah lo.
                    </FieldDescription>
                    <FieldError errors={[form.formState.errors.norma_persen]} />
                  </Field>

                </div>
              </FieldGroup>

              <div className="mt-6 flex justify-end border-t pt-4">
                <Button type="submit" disabled={simpan.isPending}>
                  {simpan.isPending ? <Loader2 className="animate-spin" /> : null}
                  Simpan pengaturan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Data disimpan lokal di <code className="font-mono text-xs">data/pajak.db</code>. Backup
          cukup dengan menyalin file itu. Tidak ada data yang dikirim ke mana pun selain permintaan
          kurs resmi ke Kemenkeu saat lo klik “Ambil”. Tahun pajak aktif sekarang: {tahun}.
        </CardContent>
      </Card>
    </>
  )
}
