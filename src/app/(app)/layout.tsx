import { createServerSupabaseClient, getUser } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import MobileTopbar from '@/components/MobileTopbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()

  // auth + count run in parallel — saves one sequential round-trip per navigation
  const [user, { count }] = await Promise.all([
    getUser(),
    supabase.from('groups').select('*', { count: 'exact', head: true }),
  ])
  // No login UI in this self-hosted single-user build — the middleware
  // (src/proxy.ts) establishes the session. If it somehow didn't, render anyway
  // rather than bouncing to a route that no longer exists.

  return (
    <div className="h-screen overflow-hidden flex bg-[var(--color-paper)]">
      <Sidebar email={user?.email ?? ''} groupCount={count ?? 0} />
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <MobileTopbar email={user?.email ?? ''} groupCount={count ?? 0} />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
