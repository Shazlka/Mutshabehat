import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/session-user'

// Single-user, self-hosted deployment: there is no login UI. The middleware
// silently establishes a session for the one account (credentials in
// AUTOLOGIN_EMAIL / AUTOLOGIN_PASSWORD) so every request is authenticated and
// RLS (`auth.uid()`) keeps working unchanged.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // The old auth pages are gone — bounce any stale links back to the app.
  if (
    pathname.startsWith('/login') || pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')
  ) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Read the session from the cookie (no auth-server round-trip unless the token
  // needs refreshing). PostgREST still verifies the JWT on every data query.
  let user: { id: string } | null = await getSessionUser(supabase)

  // No session → sign in as the single account, server-side.
  if (!user && !pathname.startsWith('/auth')) {
    const email = process.env.AUTOLOGIN_EMAIL
    const password = process.env.AUTOLOGIN_PASSWORD
    if (email && password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data.user) {
        user = data.user

        // The current Server Component request was created before the session
        // cookies existed. Re-run safe page requests once so their data queries
        // see the authenticated session immediately instead of rendering an
        // empty first page.
        if (request.method === 'GET' || request.method === 'HEAD') {
          const redirectResponse = NextResponse.redirect(request.nextUrl)
          supabaseResponse.cookies.getAll().forEach((cookie) =>
            redirectResponse.cookies.set(cookie)
          )
          return redirectResponse
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|icons|.*\\.svg).*)'],
}
