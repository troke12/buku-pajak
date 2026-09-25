import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { InputAngka } from '@/components/input-angka'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Pendapatan, PendapatanMasuk } from '@/lib/api'
import { angka, parseAngka } from '@/lib/format'
import { usePengaturan, useTambahPendapatan, useUbahPendapatan } from '@/lib/query'

const skema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  sumber: z.string().trim().min(1, 'Sumber / klien wajib diisi'),
  idr: z.string().refine((v) => parseAngka(v) > 0, 'Harus lebih dari 0'),
  bank: z.string(),
  catatan: z.string(),
})

type NilaiForm = z.infer<typeof skema>

type Props = {
  buka: boolean
  onBukaBerubah: (buka: boolean) => void
  tahun: string
  awal?: Pendapatan | null
}

export function DialogPendapatan({ buka, onBukaBerubah, tahun, awal }: Props) {
  const ubahMode = Boolean(awal)
  const tambah = useTambahPendapatan(tahun)
  const ubah = useUbahPendapatan(tahun)
  const { data: pengaturan } = usePengaturan()

  const form = useForm<NilaiForm>({
    resolver: zodResolver(skema),
    defaultValues: { tanggal: '', sumber: '', idr: '', bank: '', catatan: '' },
  })

  useEffect(() => {
    if (!buka) return
    form.reset(
      awal
        ? {
            tanggal: awal.tanggal,
            sumber: awal.sumber,
            idr: angka(awal.idr, 0),
            bank: awal.bank ?? '',
            catatan: awal.catatan ?? '',
          }
        : {
            tanggal: new Date().toISOString().slice(0, 10),
            sumber: '',
            idr: '',
            bank: pengaturan?.bank_default ?? '',
            catatan: '',
          },
    )
  }, [buka, awal, form, pengaturan])

  async function kirim(nilai: NilaiForm) {
    const isi: PendapatanMasuk = {
      tanggal: nilai.tanggal,
      sumber: nilai.sumber.trim(),
      idr: Math.round(parseAngka(nilai.idr)),
      bank: nilai.bank.trim() || null,
      catatan: nilai.catatan.trim() || null,
    }

    try {
      if (ubahMode && awal) {
        await ubah.mutateAsync({ id: awal.id, data: isi })
        toast.success('Perubahan tersimpan')
      } else {
        await tambah.mutateAsync(isi)
        toast.success('Pendapatan tersimpan')
      }
      onBukaBerubah(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    }
  }

  const sibuk = tambah.isPending || ubah.isPending

  return (
    <Dialog open={buka} onOpenChange={onBukaBerubah}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ubahMode ? 'Ubah pendapatan' : 'Catat pendapatan'}</DialogTitle>
          <DialogDescription>
            Isi apa adanya dari mutasi rekening BCA/Mandiri. Uang yang dicatat sudah dalam rupiah.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(kirim)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.tanggal)}>
                <FieldLabel htmlFor="tanggal">Tanggal uang masuk</FieldLabel>
                <Input
                  id="tanggal"
                  type="date"
                  aria-invalid={Boolean(form.formState.errors.tanggal)}
                  {...form.register('tanggal')}
                />
                <FieldDescription>Tanggal dana masuk rekening, bukan tanggal invoice.</FieldDescription>
                <FieldError errors={[form.formState.errors.tanggal]} />
              </Field>

              <Field data-invalid={Boolean(form.formState.errors.sumber)}>
                <FieldLabel htmlFor="sumber">Sumber / klien</FieldLabel>
                <Input
                  id="sumber"
                  placeholder="Mis. Upwork, klien Singapura"
                  aria-invalid={Boolean(form.formState.errors.sumber)}
                  {...form.register('sumber')}
                />
                <FieldError errors={[form.formState.errors.sumber]} />
              </Field>

              <Field className="sm:col-span-2" data-invalid={Boolean(form.formState.errors.idr)}>
                <FieldLabel htmlFor="idr">Jumlah masuk rekening</FieldLabel>
                <Controller
                  control={form.control}
                  name="idr"
                  render={({ field }) => (
                    <InputAngka
                      id="idr"
                      placeholder="26.500.000"
                      aria-invalid={Boolean(form.formState.errors.idr)}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
                <FieldDescription>
                  Angka pasti yang muncul di mutasi rekening. Ini yang jadi dasar perhitungan pajak.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.idr]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="bank">Bank</FieldLabel>
                <Input id="bank" placeholder="BCA / Mandiri" {...form.register('bank')} />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="catatan">Catatan</FieldLabel>
                <Textarea
                  id="catatan"
                  placeholder="Opsional. Mis. nomor referensi, berita transfer, atau hal yang perlu diingat."
                  {...form.register('catatan')}
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onBukaBerubah(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={sibuk}>
              {sibuk ? <Loader2 className="animate-spin" /> : null}
              {ubahMode ? 'Simpan perubahan' : 'Simpan pendapatan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
