// TEMPORARY diagnostic (branch diag/dns-region only): compares DNS + Funnel reachability per Vercel region.
import dns from 'node:dns/promises'

export async function runDiag() {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  const out: Record<string, unknown> = { region: process.env.VERCEL_REGION ?? null, host }
  const attempt = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now()
    try { return { name, ok: true, ms: Date.now() - t0, value: await fn() } }
    catch (e) { return { name, ok: false, ms: Date.now() - t0, error: String((e as Error)?.message ?? e) } }
  }
  const runs = []
  for (let i = 0; i < 5; i++) {
    runs.push(await attempt('lookup', () => dns.lookup(host, { all: true })))
    runs.push(await attempt('resolve4', () => dns.resolve4(host)))
    runs.push(await attempt('fetch-health', async () => {
      const t = Date.now(); const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { cache: 'no-store' })
      return { status: r.status, ms: Date.now() - t }
    }))
  }
  out.runs = runs
  return out
}
