import { Suspense, cache } from 'react'
import { createServerSupabaseClient, getUser } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import MobileTopbar from '@/components/MobileTopbar'

// User + group count for the nav chrome. Cached per request so the sidebar and the mobile
// topbar share one round-trip; auth + count run in parallel.
const getShellData = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const [user, { count }] = await Promise.all([
    getUser(),
    supabase.from('groups').select('*', { count: 'exact', head: true }),
  ])
  return { email: user?.email ?? '', groupCount: count ?? 0 }
})

async function SidebarWithData() {
  const { email, groupCount } = await getShellData()
  return <Sidebar email={email} groupCount={groupCount} />
}

async function TopbarWithData() {
  const { email, groupCount } = await getShellData()
  return <MobileTopbar email={email} groupCount={groupCount} />
}

// The layout itself awaits nothing: the shell (nav + page skeleton) streams immediately and the
// user/count fill in behind Suspense instead of gating first paint on two database round-trips.
// No login UI in this self-hosted single-user build — the middleware (src/proxy.ts) establishes
// the session.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden flex bg-[var(--color-paper)]">
      <Suspense fallback={<Sidebar email="" groupCount={null} />}>
        <SidebarWithData />
      </Suspense>
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <Suspense fallback={<MobileTopbar email="" groupCount={null} />}>
          <TopbarWithData />
        </Suspense>
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
