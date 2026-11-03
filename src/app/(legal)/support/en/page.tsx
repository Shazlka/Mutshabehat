import type { Metadata } from 'next'
import Link from 'next/link'
import LegalHeader from '../../_components/LegalHeader'
import LegalFooter from '../../_components/LegalFooter'

export const metadata: Metadata = {
  title: 'Support & Help — Qiraat App',
  description: 'Support and help page for the Qiraat iOS App — FAQs, contact info, and app details.',
}

export default function SupportEnglishPage() {
  return (
    <div dir="ltr" lang="en" className="min-h-screen flex flex-col">
      <LegalHeader lang="en" currentRoute="support" alternateUrl="/support" />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 focus:outline-none"
      >
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-[var(--color-ink-muted)]">
            <span className="font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border-soft)] text-[var(--color-ink-soft)]">
              com.shazlka.qiraat
            </span>
            <span aria-hidden="true">•</span>
            <span>Free App</span>
            <span aria-hidden="true">•</span>
            <span>Last updated: 2026-11-03</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] mb-3">
            Support & Help — Qiraat App
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
            Welcome to the support page for the <strong>Qiraat</strong> app (قراءات). We are here to
            assist you with any questions, technical inquiries, or feedback regarding the app.
          </p>
        </div>

        <div className="space-y-6">
          {/* Section 1: What the app is */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              About the App
            </h2>
            <div className="space-y-3 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                <strong>Qiraat</strong> (bundle identifier:{' '}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-ink)]">
                  com.shazlka.qiraat
                </code>
                ) is a free iOS application designed for the study of the Noble Quran, the Ten
                canonical Qiraat readings, and mutashabihat (similar verses).
              </p>
              <p>
                The app provides page-accurate Mushaf representations, reader-specific rules,
                explanations of Farsh and Usul variants, and traditional mutoon texts. Qiraat is
                completely free, requires no account, contains no ads, and keeps your bookmarks,
                notes, and progress stored locally on your device.
              </p>
            </div>
          </section>

          {/* Section 2: Contact */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              Contact & Support Inquiries
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-4">
              If you experience any technical issues, or would like to share feedback and suggestions,
              please reach out to us:
            </p>
            <dl className="space-y-2 text-sm sm:text-base">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--color-border-soft)] pb-2">
                <dt className="text-[var(--color-ink-muted)]">Support Email:</dt>
                <dd>
                  <code className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink)]">
                    SUPPORT_EMAIL_TBD
                  </code>
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
                <dt className="text-[var(--color-ink-muted)]">Operator / Legal Entity:</dt>
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
              Frequently Asked Questions (FAQ)
            </h2>

            <div className="space-y-4">
              {/* FAQ 1: Offline Use */}
              <div className="border-b border-[var(--color-border-soft)] pb-4">
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)] mb-1.5">
                  Does the app work offline?
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  Yes. Once the Qiraat page data and mutoon texts are downloaded to your device from
                  the developer&apos;s server, they are stored locally on the device so that you can
                  read and explore without needing an active internet connection.
                </p>
              </div>

              {/* FAQ 2: Backups */}
              <div className="border-b border-[var(--color-border-soft)] pb-4">
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)] mb-1.5">
                  How do I back up my data?
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  All your personal data (reading history, memorization progress, bookmarks, personal
                  notes, and custom mutashabihat groups) remains exclusively on your device. You can
                  back up your data by explicitly exporting backup files from within the app and
                  saving them to your preferred destination (such as the Files app or your private
                  cloud storage).
                </p>
              </div>

              {/* FAQ 3: Language Change */}
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)] mb-1.5">
                  How do I change the app language?
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  The app automatically adopts your iOS device&apos;s system language. If you wish to
                  change the language specifically for Qiraat:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--color-ink-soft)] mt-2 ps-1">
                  <li>Open the <strong>Settings</strong> app on your iOS device.</li>
                  <li>Scroll down and select <strong>Qiraat</strong>.</li>
                  <li>Under <strong>Preferred Language</strong>, choose your preferred language.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Section 4: Privacy Policy Link */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              Privacy Policy
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-3">
              We are committed to user privacy. The app collects no personal data, contains no
              tracking or ads, and requires no user accounts. To review the complete privacy terms:
            </p>
            <Link
              href="/privacy/en"
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-bold inline-flex items-center gap-1.5 transition-colors underline-offset-4 hover:underline"
            >
              <span>Read the full Privacy Policy</span>
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        </div>
      </main>

      <LegalFooter lang="en" />
    </div>
  )
}
