'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
      <form onSubmit={handleSignup}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900">إنشاء حساب جديد</h1>
          <p className="text-sm text-slate-500 mt-1">متشابهات القرآن الكريم</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            placeholder="you@example.com" dir="ltr" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">كلمة المرور</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            dir="ltr" placeholder="على الأقل 6 أحرف" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3">
            تم إنشاء الحساب! تحقق من بريدك للتأكيد، ثم سجل الدخول.
          </div>
        )}

        <button type="submit" disabled={loading || success}
          className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold py-2.5 rounded-xl shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition">
          {loading ? 'جارٍ الإنشاء...' : 'إنشاء حساب'}
        </button>

        <p className="text-center text-sm text-slate-500">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="text-indigo-600 font-bold hover:underline">سجل الدخول</Link>
        </p>
      </form>
    </div>
  )
}
