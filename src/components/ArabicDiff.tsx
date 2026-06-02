import { Fragment } from 'react'
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
// Mobile-first sizing: smaller on phones, larger on md+ screens.
export default function ArabicDiff({ parts, className, size = 'md' }: Props) {
  const sizeClass =
    size === 'sm' ? 'text-[15px] leading-[2.0] md:text-[18px] md:leading-[2.2]' :
    size === 'lg' ? 'text-[19px] leading-[2.1] md:text-[26px] md:leading-[2.4]' :
                    'text-[17px] leading-[2.05] md:text-[22px] md:leading-[2.3]'

  return (
    <p dir="rtl" className={cn('font-quran', sizeClass, className)}>
      {parts.map((p, i) => {
        const next = parts[i + 1]
        const needsSpace = next !== undefined
          && !p.text.endsWith(' ')
          && !next.text.startsWith(' ')
        return (
          <Fragment key={i}>
            <span className={`part-${p.type}`}>{p.text}</span>
            {needsSpace && ' '}
          </Fragment>
        )
      })}
    </p>
  )
}
