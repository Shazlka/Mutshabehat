import NewGroupForm from '@/components/NewGroupForm'

export const metadata = { title: 'مجموعة جديدة — متشابهات' }

export default function NewGroupPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-14">
      <header className="mb-10">
        <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-1">
          New
        </p>
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-none">
          إضافة مجموعة جديدة
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
          أدخل عنواناً للمتشابه واختر لوناً مميزاً. ستضيف الآيات في الخطوة التالية.
        </p>
      </header>
      <NewGroupForm />
    </div>
  )
}
