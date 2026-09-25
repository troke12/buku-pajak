import { useRef } from 'react'

import { Input } from '@/components/ui/input'
import { rapikanAngka } from '@/lib/format'

type Props = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (nilai: string) => void
  desimal?: boolean
}

/** Input angka dengan format ribuan Indonesia dan posisi kursor yang dijaga. */
export function InputAngka({ value, onValueChange, desimal = false, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  function ubah(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target
    const digitSebelum = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, '').length
    const rapi = rapikanAngka(el.value, desimal)
    onValueChange(rapi)

    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      let dihitung = 0
      let i = 0
      for (; i < node.value.length && dihitung < digitSebelum; i += 1) {
        if (/\d/.test(node.value[i])) dihitung += 1
      }
      node.setSelectionRange(i, i)
    })
  }

  return (
    <Input
      ref={ref}
      inputMode={desimal ? 'decimal' : 'numeric'}
      value={value}
      onChange={ubah}
      {...rest}
    />
  )
}
