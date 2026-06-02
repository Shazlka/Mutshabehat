import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Allow only clean relative paths — reject protocol-relative (//…) and absolute URLs.
function safeNextPath(raw: string | null): string {
  if (raw && /^\/(?!\/)/.test(raw)) return raw
  return '/'
}

// Validate a host string: no slashes, no @, no protocol schemes.
function isValidHost(host: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-._]*(:\d+)?$/.test(host)
}

// Supabase redirects here after email confirmation / OAuth.
// We exchange the code for a session, then redirect to the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const cookieStore = await cookies()
    // Create a fresh (non-cached) client so setAll can write cookies to the response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // On Vercel the internal request.url origin may differ from the public host.
      // Only trust x-forwarded-host when it matches the configured site URL.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const configuredHost = process.env.NEXT_PUBLIC_SITE_URL
        ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host
        : null
      const useForwarded =
        process.env.NODE_ENV !== 'development' &&
        forwardedHost &&
        isValidHost(forwardedHost) &&
        (!configuredHost || forwardedHost === configuredHost)
      return NextResponse.redirect(
        useForwarded ? `https://${forwardedHost}${next}` : `${origin}${next}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
