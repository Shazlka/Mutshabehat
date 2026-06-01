import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import MobileTopbar from '@/components/MobileTopbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count } = await supabase
    .from('groups')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="min-h-screen flex bg-[var(--color-paper)]">
      <Sidebar email={user.email ?? ''} groupCount={count ?? 0} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopbar groupCount={count ?? 0} />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
