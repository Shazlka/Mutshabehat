import type { Metadata } from 'next'
import Link from 'next/link'
import LegalHeader from '../_components/LegalHeader'
import LegalFooter from '../_components/LegalFooter'

export const metadata: Metadata = {
  title: 'الدعم والمساعدة — تطبيق قراءات (Qiraat)',
  description: 'صفحة الدعم الفني والمساعدة لتطبيق قراءات (Qiraat) لنظام iOS — الأسئلة الشائعة وقنوات التواصل.',
}

export default function SupportPage() {
  return (
    <>
      <LegalHeader lang="ar" currentRoute="support" alternateUrl="/support/en" />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 focus:outline-none"
        dir="rtl"
        lang="ar"
      >
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-[var(--color-ink-muted)]">
            <span className="font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border-soft)] text-[var(--color-ink-soft)]">
              com.shazlka.qiraat
            </span>
            <span aria-hidden="true">•</span>
            <span>تطبيق مجاني</span>
            <span aria-hidden="true">•</span>
            <span>آخر تحديث: 2026-11-03</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] mb-3">
            الدعم الفني والمساعدة — تطبيق قراءات (Qiraat)
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
            مرحبًا بك في صفحة الدعم والمساعدة لتطبيق <strong>قراءات</strong> (Qiraat). نسعد بتقديم
            المساعدة والإجابة عن استفساراتك واستقبال مقترحاتك وملاحظاتك حول التطبيق.
          </p>
        </div>

        <div className="space-y-6">
          {/* Section 1: What the app is */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              عن التطبيق
            </h2>
            <div className="space-y-3 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                <strong>قراءات</strong> (معرّف الحزمة:{' '}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-ink)]">
                  com.shazlka.qiraat
                </code>
                ) هو تطبيق iOS مجاني مخصص لخدمة وتيسير دراسة القرآن الكريم، القراءات العشر المتواترة،
                ومتفردات ومتشابهات الآيات.
              </p>
              <p>
                يقدم التطبيق عرضًا مطابقًا لرسم المصحف وضبطه، مع توضيح الفروق القرائية وأصول الروايات،
                وعرض نصوص المتون العلمية التخصصية وشروحها. التطبيق مجاني بالكامل، يعمل بدون إعلانات أو
                حسابات، وتُحفظ جميع بياناتك وملاحظاتك محليًا على جهازك فقط.
              </p>
            </div>
          </section>

          {/* Section 2: Contact */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              التواصل والدعم الفني
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-4">
              إذا واجهت أي صعوبة تقنية، أو كانت لديك اقتراحات أو استفسارات حول التطبيق، يرجى مراسلتنا
              عبر البريد الإلكتروني:
            </p>
            <dl className="space-y-2 text-sm sm:text-base">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--color-border-soft)] pb-2">
                <dt className="text-[var(--color-ink-muted)]">البريد الإلكتروني للدعم:</dt>
                <dd>
                  <code className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink)]">
                    SUPPORT_EMAIL_TBD
                  </code>
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
                <dt className="text-[var(--color-ink-muted)]">الجهة المشغلة / الاسم القانوني:</dt>
                <dd>
                  <code className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink)]">
                    OPERATOR_NAME_TBD
                  </code>
                </dd>
              </div>
            </dl>
          </section>

          {/* Section 3: FAQ */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              الأسئلة الشائعة (FAQ)
            </h2>

            <div className="space-y-4">
              {/* FAQ 1: Offline Use */}
              <div className="border-b border-[var(--color-border-soft)] pb-4">
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)] mb-1.5">
                  هل يعمل التطبيق دون اتصال بالإنترنت (Offline)؟
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  نعم. بعد تنزيل بيانات صفحات القراءات ونصوص المتون من خادم التطبيق عند الاستخدام، يتم
                  تخزين تلك البيانات محليًا على جهازك ليعمل التطبيق بكامل طاقته دون الحاجة إلى اتصال دائم
                  بالإنترنت.
                </p>
              </div>

              {/* FAQ 2: Backups */}
              <div className="border-b border-[var(--color-border-soft)] pb-4">
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)] mb-1.5">
                  كيف يمكنني أخذ نسخة احتياطية من بياناتي؟
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  تُحفظ جميع بياناتك (موضع القراءة وتاريخها، تقدم الحفظ، الفواصل، الملاحظات، ومجموعات
                  المتشابهات الشخصية) محليًا على جهازك فقط لضمان الخصوصية التامة. يمكنك أخذ نسخة
                  احتياطية من خلال تصدير ملفات النسخ الاحتياطي يدويًا وصريحًا من داخل التطبيق وحفظها في
                  المكان الذي يناسبك (مثل تطبيق الملفات Files أو التخزين السحابي الخاص بك).
                </p>
              </div>

              {/* FAQ 3: Language Change */}
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)] mb-1.5">
                  كيف أقوم بتغيير لغة التطبيق؟
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  يعتمد التطبيق لغة النظام لجهاز iOS تلقائيًا. لتخصيص لغة تطبيق قراءات بشكل مستقل:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--color-ink-soft)] mt-2 ps-1">
                  <li>افتح تطبيق <strong>الإعدادات (Settings)</strong> في جهاز iOS.</li>
                  <li>مرر للأسفل حتى تجد تطبيق <strong>قراءات (Qiraat)</strong>.</li>
                  <li>اضغط على <strong>اللغة المفضلة (Preferred Language)</strong> واختر اللغة المناسبة.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Section 4: Privacy Policy Link */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              سياسة الخصوصية
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-3">
              نحن ملتزمون بحماية خصوصيتك؛ لا يجمع التطبيق أي بيانات شخصية، ولا يتطلب حسابًا، ولا يتضمن أي
              إعلانات أو تتبع. للاطلاع على كامل بنود الخصوصية وممارسات البيانات:
            </p>
            <Link
              href="/privacy"
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-bold inline-flex items-center gap-1.5 transition-colors underline-offset-4 hover:underline"
            >
              <span>قراءة سياسة الخصوصية الكاملة لتطبيق قراءات</span>
              <span aria-hidden="true">←</span>
            </Link>
          </section>
        </div>
      </main>

      <LegalFooter lang="ar" />
    </>
  )
}
