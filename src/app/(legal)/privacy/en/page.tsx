import type { Metadata } from 'next'
import Link from 'next/link'
import LegalHeader from '../../_components/LegalHeader'
import LegalFooter from '../../_components/LegalFooter'

export const metadata: Metadata = {
  title: 'Privacy Policy — Qiraat App',
  description: 'Privacy Policy for the Qiraat iOS App — No accounts, no tracking, no data collection.',
}

export default function PrivacyEnglishPage() {
  return (
    <div dir="ltr" lang="en" className="min-h-screen flex flex-col">
      <LegalHeader lang="en" currentRoute="privacy" alternateUrl="/privacy" />

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
            Privacy Policy — Qiraat App
          </h1>
          <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
            Your privacy is fundamental to us. The <strong>Qiraat</strong> app (bundle identifier:{' '}
            <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-ink)]">
              com.shazlka.qiraat
            </code>
            ) is designed and built to serve readers and students of the Holy Quran without collecting
            any personal data, without user accounts, and without any advertising or tracking.
          </p>
        </div>

        <div className="space-y-6">
          {/* Section 1: No accounts, ads, tracking */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              1. No Accounts, No Ads, No Tracking
            </h2>
            <div className="space-y-2 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                <strong>Completely Free:</strong> The app is free of charge for all users.
              </p>
              <p>
                <strong>No Account or Login Required:</strong> You can use all features immediately
                without creating an account, signing in, or providing any personal identity details.
              </p>
              <p>
                <strong>No Advertisements:</strong> The app does not display any commercial advertisements.
              </p>
              <p>
                <strong>No Analytics or Tracking:</strong> We do not track your activity, collect analytics,
                or integrate any third-party SDKs (No third-party SDKs).
              </p>
            </div>
          </section>

          {/* Section 2: On-device storage only */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              2. Stored on Your Device Only
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-3">
              All your app data is stored <strong>locally on your device only</strong>. The developer
              has no access to this data. This includes:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm sm:text-base text-[var(--color-ink-soft)] ps-2">
              <li>Reading position and reading history.</li>
              <li>Memorization and revision progress.</li>
              <li>Bookmarks.</li>
              <li>Personal notes and reflections.</li>
              <li>Personal mutashabihat groups.</li>
              <li>App settings and display preferences.</li>
            </ul>
          </section>

          {/* Section 3: Network communications */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              3. Network Communications & Server Access
            </h2>
            <div className="space-y-2 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                The app connects to the developer&apos;s server over secure HTTPS via a read-only
                endpoint solely to download Qiraat page data and mutoon (scholarly poem) texts.
              </p>
              <p>
                These network requests carry no personal data, no user account, and no device or user
                identifier.
              </p>
              <p>
                Like any standard web server, the host server may see the IP address and request
                timestamp transiently during standard transmission to fulfill the request.
              </p>
              <p>
                Nothing from the app is ever sold or shared with any third party.
              </p>
            </div>
          </section>

          {/* Section 4: Data deletion and backups */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              4. Data Deletion and Backups
            </h2>
            <div className="space-y-2 text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              <p>
                <strong>Data Deletion:</strong> You can delete all app data at any time simply by
                deleting the app from your device (and, in a later version, directly from the app
                Settings).
              </p>
              <p>
                <strong>Backups:</strong> Backups are files that you explicitly choose to export from
                the app and store in your preferred location.
              </p>
            </div>
          </section>

          {/* Section 5: Children's privacy */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              5. Children&apos;s Privacy
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed">
              The app does not knowingly collect any personal data from children; the app has no user
              accounts and collects no personal data from any user.
            </p>
          </section>

          {/* Section 6: Contact and Operator */}
          <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] p-5 sm:p-6 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
              6. Contact Information & Legal Entity
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-ink-soft)] leading-relaxed mb-4">
              If you have any questions or feedback regarding this Privacy Policy, please contact us:
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
                <dt className="text-[var(--color-ink-muted)]">Operator / Legal Name:</dt>
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
              href="/support/en"
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Need help or have questions? Visit our Support & Help page</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </main>

      <LegalFooter lang="en" />
    </div>
  )
}
