// Reads the signed-in user from the session cookie WITHOUT a GoTrue round-trip.
//
// `auth.getUser()` calls the auth server on every request, and the backend sits on the
// Mac Mini behind Tailscale Funnel, so each call costs seconds. Decoding the cookie's JWT
// locally is safe here: every data read/write still goes through PostgREST, which verifies
// the JWT signature and enforces RLS, so a forged cookie can't read or change anything.
// (getSession() only hits the network when the access token has expired and needs a refresh.)

export type SessionUser = { id: string; email: string }

type AuthLike = {
  auth: { getSession: () => Promise<{ data: { session: { access_token?: string } | null } }> }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1]
  if (!segment) return null
  try {
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

export async function getSessionUser(supabase: AuthLike): Promise<SessionUser | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null
  const claims = decodeJwtPayload(token)
  if (!claims || typeof claims.sub !== 'string') return null
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' }
}
