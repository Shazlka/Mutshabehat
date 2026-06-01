'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LogoutButton() {
  const router = useRouter()
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <button onClick={handleLogout}
      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 transition">
      خروج
    </button>
  )
}
