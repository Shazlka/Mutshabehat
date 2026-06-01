import { cn } from '@/lib/cn'

export interface Part {
  type: 'shared' | 'diff' | 'diff2' | 'diff3' | 'addition' | 'unique' | 'normal' | string
  text: string
}

interface Props {
  parts: Part[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

// Renders Quranic text with color-highlighted parts inline.
// No left-stripe borders, no boxes — parts are inline spans.
export default function ArabicDiff({ parts, className, size = 'md' }: Props) {
  const sizeClass =
    size === 'sm' ? 'text-[18px] leading-[2.2]' :
    size === 'lg' ? 'text-[26px] leading-[2.4]' :
                    'text-[22px] leading-[2.3]'

  return (
    <p dir="rtl" className={cn('font-quran', sizeClass, className)}>
      {parts.map((p, i) => (
        <span key={i} className={`part-${p.type}`}>{p.text}</span>
      ))}
    </p>
  )
}
