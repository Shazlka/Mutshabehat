// Server-only Supabase client. Use in Server Components, API Routes, and middleware.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { getSessionUser } from '@/lib/session-user'
import { resilientFetch } from '@/lib/resilient-fetch'

// Wrapped in React cache() so multiple server components in the same request
// share one client instance instead of each creating their own.
export const createServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: resilientFetch },
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context — cookies set via middleware
          }
        },
      },
    }
  )
})

// Cached per-request user — read from the session cookie, no auth round-trip.
export const getUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  return getSessionUser(supabase)
})
