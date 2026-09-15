import { createServerSupabaseClient } from '@/lib/supabase-server'
import TagToolbox from '@/components/TagToolbox'
import TagManager from '@/components/TagManager'
import ClearCacheButton from '@/components/ClearCacheButton'
import DatabaseExport from '@/components/DatabaseExport'
import SwipeNavigationSetting from '@/components/SwipeNavigationSetting'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-14">
      <header className="mb-12">
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-none">إعدادات</h1>
      </header>

      <section className="space-y-8">
        <div>
          <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2">
            الحساب
          </div>
          <dl className="space-y-3 text-[14px]">
            <div className="flex justify-between border-b border-[var(--color-border-soft)] pb-3">
              <dt className="text-[var(--color-ink-muted)]">البريد الإلكتروني</dt>
              <dd className="font-mono text-[var(--color-ink)]" dir="ltr">{user?.email}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border-soft)] pb-3">
              <dt className="text-[var(--color-ink-muted)]">معرف المستخدم</dt>
              <dd className="font-mono text-[11px] text-[var(--color-ink-soft)]" dir="ltr">{user?.id}</dd>
            </div>
          </dl>
        </div>

        <div>
          <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2">
            البيانات
          </div>
          <p className="text-[13px] text-[var(--color-ink-soft)] leading-relaxed">
            تُحفظ بياناتك تلقائياً في Supabase. لا توجد حاجة لمزامنة يدوية.
            يمكنك الوصول إليها من أي جهاز بعد تسجيل الدخول.
          </p>
        </div>

        <div>
          <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3">
            التنقل
          </div>
          <SwipeNavigationSetting />
        </div>

        <div>
          <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3">
            إدارة الوسوم
          </div>
          <TagManager />
        </div>

        <div>
          <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3">
            تصدير قاعدة البيانات الشخصية
          </div>
          <DatabaseExport />
        </div>

        <div>
          <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3">
            تصدير / استيراد الوسوم
          </div>
          <TagToolbox />
        </div>

        <div>
          <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3">
            التخزين المؤقت
          </div>
          <ClearCacheButton />
        </div>

        <div>
          <form action="/auth/signout" method="POST">
            <button type="submit"
              className="text-[13px] text-[var(--color-danger)] hover:underline underline-offset-4 transition-colors">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
