'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Invisible component — calls router.prefetch() for both neighbours as soon as
// the page mounts. Next.js runs the server components for those routes and caches
// the RSC payload, so tapping prev/next is instant (served from cache).
export default function PrefetchNeighbours({
  prev, next,
}: { prev?: string | null; next?: string | null }) {
  const router = useRouter()
  useEffect(() => {
    if (prev) router.prefetch(prev)
    if (next) router.prefetch(next)
  }, [prev, next, router])
  return null
}
