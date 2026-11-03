import type { Metadata } from 'next'
import Link from 'next/link'
import LegalHeader from '../_components/LegalHeader'
import LegalFooter from '../_components/LegalFooter'

export const metadata: Metadata = {
  title: 'سياسة الخصوصية — تطبيق قراءات (Qiraat)',
  description: 'سياسة الخصوصية لتطبيق قراءات (Qiraat) لنظام iOS — لا جمع للبيانات، لا حسابات، ولا تتبع.',
}

export default function PrivacyPage() {
  return (
    <>
      <LegalHeader lang="ar" currentRoute="privacy" alternateUrl="/privacy/en" />

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
            سياسة الخصوصية — تطبيق قراءات (Qiraat)
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
            خصوصيتك في صميم اهتمامنا. صُمم تطبيق <strong>قراءات</strong> (المعرّف البرمجي:{' '}
            <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-ink)]">
              com.shazlka.qiraat
            </code>
            ) ليكون وسيلة لدراسة كتاب الله وتلاوته بالقراءات العشر، دون أي جمع لبياناتك الشخصية، ودون
            حسابات، ودون تتبع أو إعلانات.
          </p>
        </div>

        <div className="space-y-6">
          {/* Section 1: No accounts, ads, tracking */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              1. لا حسابات، لا إعلانات، ولا تتبع
            </h2>
            <div className="space-y-2 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                <strong>تطبيق مجاني بالكامل:</strong> التطبيق متاح مجانًا لجميع المستخدمين.
              </p>
              <p>
                <strong>بدون حساب أو تسجيل دخول:</strong> لا يتطلب التطبيق أي إنشاء حساب أو تسجيل دخول
                أو تقديم أي معرفات شخصية.
              </p>
              <p>
                <strong>خالٍ من الإعلانات:</strong> لا يحتوي التطبيق على أي إعلانات تجارية.
              </p>
              <p>
                <strong>خالٍ من أدوات التحليلات والتتبع:</strong> لا يحتوي التطبيق على أي برمجيات تتبع،
                ولا تحليلات سلوك المستخدم، ولا يدمج أي حزم برمجية لأطراف ثالثة (No third-party SDKs).
              </p>
            </div>
          </section>

          {/* Section 2: On-device storage only */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              2. حفظ البيانات على جهازك فقط
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-3">
              تُحفظ جميع بياناتك داخل التطبيق <strong>على جهازك فقط</strong>، ولا يمكن للمطور الوصول
              إليها أو الاطلاع عليها بأي وسيلة. تشمل هذه البيانات:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm sm:text-base text-[var(--color-ink-soft)] ps-2">
              <li>موضع القراءة وتاريخ التصفح.</li>
              <li>تقدم الحفظ والمراجعة.</li>
              <li>الفواصل والعلامات المرجعية (Bookmarks).</li>
              <li>الملاحظات والتدوينات الشخصية.</li>
              <li>مجموعات المتشابهات الشخصية.</li>
              <li>إعدادات التطبيق وتفضيلات العرض.</li>
            </ul>
          </section>

          {/* Section 3: Network communications */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              3. الاتصال بالشبكة وخوادم التطبيق
            </h2>
            <div className="space-y-2 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                يقوم التطبيق بالاتصال بخادم المطور عبر اتصال مشفر وآمن (HTTPS) بنقطة نهاية للقراءة فقط
                (read-only endpoint) لتنزيل بيانات صفحات القراءات العشر ونصوص المتون العلمية.
              </p>
              <p>
                هذه الطلبات لا تحمل أي بيانات شخصية، ولا أي حساب، ولا أي معرف خاص بالجهاز أو المستخدم.
              </p>
              <p>
                كما هو الحال مع أي خادم ويب قياسي، قد يرى خادم الاستضافة عنوان IP ووقت الطلب بصورة عابرة
                ومؤقتة أثناء إتمام عملية الاتصال ونقل البيانات فقط.
              </p>
              <p>
                لا يتم بيع أي شيء من بيانات التطبيق أو مشاركته مع أي طرف ثالث على الإطلاق.
              </p>
            </div>
          </section>

          {/* Section 4: Data deletion and backups */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              4. حذف البيانات والنسخ الاحتياطي
            </h2>
            <div className="space-y-2 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                <strong>حذف البيانات:</strong> يمكن للمستخدم حذف جميع بيانات التطبيق بالكامل وفي أي وقت
                بمجرد حذف التطبيق من جهازه (وسيتاح ذلك أيضًا من داخل إعدادات التطبيق في إصدار لاحق).
              </p>
              <p>
                <strong>النسخ الاحتياطي:</strong> النسخ الاحتياطية عبارة عن ملفات يقوم المستخدم
                بتصديرها بنفسه وبشكل صريح من داخل التطبيق وحفظها في الموقع الذي يختاره.
              </p>
            </div>
          </section>

          {/* Section 5: Children's privacy */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              5. خصوصية الأطفال
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              لا يجمع التطبيق عن علم أي بيانات شخصية من الأطفال؛ إذ إن التطبيق لا يتضمن إنشاء حسابات ولا
              يقوم بجمع أي بيانات شخصية من أي مستخدم.
            </p>
          </section>

          {/* Section 6: Contact and Operator */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              6. معلومات التواصل والجهة المشغلة
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-4">
              إذا كان لديك أي سؤال أو استفسار حول سياسة الخصوصية، يمكنك التواصل معنا عبر:
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

          {/* Navigation to Support */}
          <div className="pt-2 text-center sm:text-start">
            <Link
              href="/support"
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <span>هل تحتاج إلى مساعدة أو لديك استفسار؟ انتقل إلى صفحة الدعم الفني</span>
              <span aria-hidden="true">←</span>
            </Link>
          </div>
        </div>
      </main>

      <LegalFooter lang="ar" />
    </>
  )
}
