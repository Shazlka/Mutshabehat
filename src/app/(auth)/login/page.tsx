'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
      <form onSubmit={handleLogin}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900">تسجيل الدخول</h1>
          <p className="text-sm text-slate-500 mt-1">متشابهات القرآن الكريم</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
          <input type="email" id="email" name="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            placeholder="you@example.com" dir="ltr" />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-bold text-slate-700">كلمة المرور</label>
          <input type="password" id="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            dir="ltr" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold py-2.5 rounded-xl shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition">
          {loading ? 'جارٍ الدخول...' : 'دخول'}
        </button>

        <p className="text-center text-sm text-slate-500">
          ليس لديك حساب؟{' '}
          <Link href="/signup" className="text-indigo-600 font-bold hover:underline">إنشاء حساب</Link>
        </p>
      </form>
    </div>
  )
}
