import { cn } from '@/lib/utils'

type Props = {
  label: string
  nilai: string
  keterangan?: string
  nada?: 'netral' | 'positif' | 'negatif'
  utama?: boolean
}

export function StatCard({ label, nilai, keterangan, nada = 'netral', utama = false }: Props) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col gap-1 rounded-lg border p-4 shadow-sm',
        utama && 'bg-primary text-primary-foreground border-primary',
      )}
    >
      <span
        className={cn(
          'text-muted-foreground text-[11px] font-semibold tracking-wide uppercase',
          utama && 'text-primary-foreground/70',
        )}
      >
        {label}
      </span>
      <span className={cn('text-2xl font-semibold tracking-tight', utama && 'text-primary-foreground')}>
        {nilai}
      </span>
      {keterangan ? (
        <span
          className={cn(
            'text-muted-foreground text-xs',
            utama && 'text-primary-foreground/70',
            nada === 'positif' && !utama && 'text-positive',
            nada === 'negatif' && !utama && 'text-negative',
          )}
        >
          {keterangan}
        </span>
      ) : null}
    </div>
  )
}
