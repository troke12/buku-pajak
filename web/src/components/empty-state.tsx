type Props = {
  judul: string
  pesan: string
  aksi?: React.ReactNode
}

export function EmptyState({ judul, pesan, aksi }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-medium">{judul}</p>
      <p className="text-muted-foreground max-w-[52ch] text-sm">{pesan}</p>
      {aksi ? <div className="mt-3">{aksi}</div> : null}
    </div>
  )
}
