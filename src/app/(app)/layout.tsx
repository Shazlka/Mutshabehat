import { createServerSupabaseClient, getUser } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import MobileTopbar from '@/components/MobileTopbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()

  // auth + count run in parallel — saves one sequential round-trip per navigation
  const [user, { count }] = await Promise.all([
    getUser(),
    supabase.from('groups').select('*', { count: 'exact', head: true }),
  ])
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex bg-[var(--color-paper)]">
      <Sidebar email={user.email ?? ''} groupCount={count ?? 0} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopbar email={user.email ?? ''} groupCount={count ?? 0} />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
