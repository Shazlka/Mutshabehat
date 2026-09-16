// Server-side fetch for the self-hosted Supabase backend.
//
// The backend is exposed through Tailscale Funnel (`*.ts.net`). Vercel's DNS resolver
// intermittently fails to resolve that hostname (`getaddrinfo ENOTFOUND`), in every region,
// which makes every page load with no data. Public resolvers answer it fine, so when the
// system lookup fails we resolve the host over DNS-over-HTTPS and connect to that IP.
// TLS still uses the real hostname (SNI + certificate check), only the IP lookup changes.
import dns from 'node:dns'
import type { LookupAddress } from 'node:dns'
import { Agent, fetch as undiciFetch } from 'undici'

type Cached = { addresses: string[]; expires: number }

const DOH_ENDPOINTS = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve']
const MIN_TTL_MS = 30_000
const MAX_TTL_MS = 300_000

const dohCache = new Map<string, Cached>()
// Last addresses that worked (system DNS or DoH); used if both lookups fail.
const lastKnownGood = new Map<string, string[]>()

async function resolveViaDoh(hostname: string): Promise<string[]> {
  const hit = dohCache.get(hostname)
  if (hit && hit.expires > Date.now()) return hit.addresses

  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?name=${encodeURIComponent(hostname)}&type=A`, {
        headers: { accept: 'application/dns-json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      })
      if (!response.ok) continue
      const body = (await response.json()) as { Answer?: Array<{ type: number; data: string; TTL: number }> }
      const answers = (body.Answer ?? []).filter((answer) => answer.type === 1)
      if (answers.length === 0) continue
      const ttlMs = Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, Math.min(...answers.map((a) => a.TTL)) * 1000))
      const addresses = answers.map((answer) => answer.data)
      dohCache.set(hostname, { addresses, expires: Date.now() + ttlMs })
      return addresses
    } catch {
      // try the next resolver
    }
  }
  throw new Error(`DNS-over-HTTPS could not resolve ${hostname}`)
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

function lookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  const reply = (addresses: string[]) => {
    const pick = addresses[Math.floor(Math.random() * addresses.length)]
    if (options.all) callback(null, addresses.map((address) => ({ address, family: 4 })))
    else callback(null, pick, 4)
  }

  const viaDoh = () => {
    resolveViaDoh(hostname)
      .then((addresses) => {
        lastKnownGood.set(hostname, addresses)
        reply(addresses)
      })
      .catch((error: NodeJS.ErrnoException) => {
        const fallback = lastKnownGood.get(hostname)
        if (fallback?.length) reply(fallback)
        else callback(error, options.all ? [] : '', 4)
      })
  }

  if (process.env.SUPABASE_FORCE_DOH === '1') return viaDoh()

  dns.lookup(hostname, { family: 4, all: true }, (error, addresses) => {
    if (!error && addresses.length > 0) {
      const list = addresses.map((entry) => entry.address)
      lastKnownGood.set(hostname, list)
      reply(list)
      return
    }
    viaDoh()
  })
}

// Explicit, aggressive timeouts: undici's defaults (10s connect, 300s headers/body) mean a
// genuinely unreachable backend (Mac Mini offline, Tailscale Funnel down at the network level —
// not just a DNS hiccup) can leave a request hanging for minutes. Every page/route already
// degrades gracefully when a Supabase call fails (empty lists, 401/503 handling — see
// CLAUDE.md's changelog), but only once the call actually fails; a multi-minute hang looks
// identical to "the app is broken" from the outside. Bounding every stage keeps a fully-down
// backend fast-failing (worst case a few seconds per call) instead of stalling until Vercel's
// own function timeout kills the request.
const agent = new Agent({
  connect: { lookup: lookup as never, timeout: 5_000 },
  connectTimeout: 5_000,
  headersTimeout: 8_000,
  bodyTimeout: 8_000,
  keepAliveTimeout: 30_000,
})

// `@supabase/postgrest-js` retries every idempotent (GET/HEAD) request up to 3 times with
// exponential backoff (1s, 2s, 4s = 7s total) on ANY fetch rejection except an `AbortError` —
// see its `PostgrestBuilder.then()`. That backoff is aimed at brief transient blips (a load
// balancer hiccup); against a genuinely unreachable backend (Mac Mini offline, Tailscale Funnel
// down) it turns an instant connection failure into a 7-second wait on every single query, and
// this app calls several queries per page — the app-level 401/503 handling and empty-state
// rendering (see CLAUDE.md's changelog, e.g. "logged-out UX 401 vs 503") only kicks in *after*
// the fetch settles, so the whole page stalls for that long even though it fails gracefully.
// This module already owns retry/fallback for the one failure mode that's actually transient
// here (DNS — system lookup, then DNS-over-HTTPS, then last-known-good). A second, generic
// retry layer on top adds a multi-second tax during a real outage without adding resilience
// PostgREST/GoTrue-side blips aren't the documented failure mode; DNS is, and that's already
// handled above. So every rejection is normalized to an `AbortError`, which postgrest-js (and
// any other consumer that follows the same fetch convention) treats as final and never retries.
// The original failure is preserved as `.cause` for logging/diagnostics.
export const resilientFetch: typeof fetch = async (input, init) => {
  try {
    return await (undiciFetch(input as never, { ...(init as object), dispatcher: agent } as never) as unknown as Promise<Response>)
  } catch (cause) {
    const error = new Error('Fetch failed (normalized to AbortError so callers do not retry a fully-down backend)', { cause })
    error.name = 'AbortError'
    ;(error as Error & { code?: string }).code = 'ABORT_ERR'
    throw error
  }
}
