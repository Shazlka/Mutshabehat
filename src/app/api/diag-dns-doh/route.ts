// TEMPORARY diagnostic (branch diag/dns-region only): does a DoH-backed lookup reach the Funnel from Vercel?
import { NextResponse } from 'next/server'
import dns from 'node:dns'
import { Agent, fetch as undiciFetch } from 'undici'

export const dynamic = 'force-dynamic'

type Cached = { addresses: string[]; expires: number }
const cache = new Map<string, Cached>()

async function dohResolve(host: string): Promise<string[]> {
  const hit = cache.get(host)
  if (hit && hit.expires > Date.now()) return hit.addresses
  for (const endpoint of ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve']) {
    try {
      const r = await fetch(`${endpoint}?name=${encodeURIComponent(host)}&type=A`, {
        headers: { accept: 'application/dns-json' }, cache: 'no-store',
      })
      const j = (await r.json()) as { Answer?: { type: number; data: string; TTL: number }[] }
      const answers = (j.Answer ?? []).filter((a) => a.type === 1)
      if (answers.length) {
        const ttl = Math.min(...answers.map((a) => a.TTL), 300)
        const addresses = answers.map((a) => a.data)
        cache.set(host, { addresses, expires: Date.now() + ttl * 1000 })
        return addresses
      }
    } catch { /* try next endpoint */ }
  }
  throw new Error(`DoH could not resolve ${host}`)
}

const agent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { family: 4 }, (err, address, family) => {
        if (!err && address) return callback(null, address, family)
        dohResolve(hostname)
          .then((addrs) => callback(null, addrs[Math.floor(Math.random() * addrs.length)], 4))
          .catch((e) => callback(e as NodeJS.ErrnoException, '', 4))
      })
    },
  },
})

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const runs = []
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now()
    try {
      const r = await undiciFetch(`${base}/auth/v1/health`, { dispatcher: agent })
      runs.push({ ok: true, status: r.status, ms: Date.now() - t0, body: (await r.text()).slice(0, 60) })
    } catch (e) {
      runs.push({ ok: false, ms: Date.now() - t0, error: String((e as Error).cause ?? e) })
    }
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, runs })
}
