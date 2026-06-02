'use client'

import { useRouter } from 'next/navigation'

interface Props {
  className?: string
  label?: string
}

export default function BackButton({ className, label = '← العودة' }: Props) {
  const router = useRouter()
  return (
    <button onClick={() => router.back()} className={className}>
      {label}
    </button>
  )
}
