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

const agent = new Agent({ connect: { lookup: lookup as never }, keepAliveTimeout: 30_000 })

export const resilientFetch: typeof fetch = (input, init) =>
  undiciFetch(input as never, { ...(init as object), dispatcher: agent } as never) as unknown as Promise<Response>
