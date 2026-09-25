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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { SetoranMasuk } from '@/lib/api'
import { parseAngka } from '@/lib/format'
import { JENIS_SETORAN } from '@/lib/konstanta'
import { useTambahSetoran } from '@/lib/query'

const skema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  jenis: z.string().min(1, 'Jenis setoran wajib dipilih'),
  masa: z.string(),
  jumlah: z.string().refine((v) => parseAngka(v) > 0, 'Harus lebih dari 0'),
  catatan: z.string(),
})

type NilaiForm = z.infer<typeof skema>

type Props = {
  buka: boolean
  onBukaBerubah: (buka: boolean) => void
  tahun: string
}

export function DialogSetoran({ buka, onBukaBerubah, tahun }: Props) {
  const tambah = useTambahSetoran(tahun)
  const form = useForm<NilaiForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      tanggal: new Date().toISOString().slice(0, 10),
      jenis: 'PPh Pasal 25',
      masa: '',
      jumlah: '',
      catatan: '',
    },
  })

  useEffect(() => {
    if (buka) {
      form.reset({
        tanggal: new Date().toISOString().slice(0, 10),
        jenis: 'PPh Pasal 25',
        masa: '',
        jumlah: '',
        catatan: '',
      })
    }
  }, [buka, form])

  async function kirim(nilai: NilaiForm) {
    const isi: SetoranMasuk = {
      tanggal: nilai.tanggal,
      jenis: nilai.jenis,
      masa: nilai.masa.trim() || null,
      jumlah: Math.round(parseAngka(nilai.jumlah)),
      catatan: nilai.catatan.trim() || null,
    }
    try {
      await tambah.mutateAsync(isi)
      toast.success('Setoran tersimpan')
      onBukaBerubah(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    }
  }

  return (
    <Dialog open={buka} onOpenChange={onBukaBerubah}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat setoran</DialogTitle>
          <DialogDescription>Isi sesuai bukti pembayaran (BPN) dari e-billing DJP.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(kirim)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.tanggal)}>
                <FieldLabel htmlFor="setoran-tanggal">Tanggal bayar</FieldLabel>
                <Input
                  id="setoran-tanggal"
                  type="date"
                  aria-invalid={Boolean(form.formState.errors.tanggal)}
                  {...form.register('tanggal')}
                />
                <FieldError errors={[form.formState.errors.tanggal]} />
              </Field>

              <Field data-invalid={Boolean(form.formState.errors.jenis)}>
                <FieldLabel htmlFor="setoran-jenis">Jenis setoran</FieldLabel>
                <Controller
                  control={form.control}
                  name="jenis"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="setoran-jenis" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JENIS_SETORAN.map((j) => (
                          <SelectItem key={j} value={j}>
                            {j}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[form.formState.errors.jenis]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="setoran-masa">Masa pajak</FieldLabel>
                <Input id="setoran-masa" placeholder="2026-08" {...form.register('masa')} />
                <FieldDescription>Bulan pajak yang dibayar, format YYYY-MM.</FieldDescription>
              </Field>

              <Field data-invalid={Boolean(form.formState.errors.jumlah)}>
                <FieldLabel htmlFor="setoran-jumlah">Jumlah setoran</FieldLabel>
                <Controller
                  control={form.control}
                  name="jumlah"
                  render={({ field }) => (
                    <InputAngka
                      id="setoran-jumlah"
                      placeholder="1.000.000"
                      aria-invalid={Boolean(form.formState.errors.jumlah)}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
                <FieldError errors={[form.formState.errors.jumlah]} />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="setoran-catatan">Catatan</FieldLabel>
                <Textarea
                  id="setoran-catatan"
                  placeholder="Mis. NTPN, kode billing, atau keterangan lain"
                  {...form.register('catatan')}
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onBukaBerubah(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={tambah.isPending}>
              {tambah.isPending ? <Loader2 className="animate-spin" /> : null}
              Simpan setoran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
