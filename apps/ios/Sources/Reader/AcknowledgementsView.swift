import SwiftUI

/// The web pages Settings → «الخصوصية والدعم» opens in Safari. App Store Guideline 5.1.1 asks for the privacy policy
/// to be reachable inside the app; each page has an Arabic and an English version, picked by the app language.
enum LegalLinks {
    static func privacyPolicy(for language: AppLanguage) -> URL {
        language == .english
            ? URL(string: "https://mutshabehat-v2.vercel.app/privacy/en")!
            : URL(string: "https://mutshabehat-v2.vercel.app/privacy")!
    }

    static func support(for language: AppLanguage) -> URL {
        language == .english
            ? URL(string: "https://mutshabehat-v2.vercel.app/support/en")!
            : URL(string: "https://mutshabehat-v2.vercel.app/support")!
    }

    /// "1.0 (12)": `CFBundleShortVersionString` and `CFBundleVersion`, wrapped in a left-to-right isolate so the
    /// parentheses stay put in an Arabic layout.
    static var appVersion: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\u{2066}\(version) (\(build))\u{2069}"
    }
}

/// Settings → «شكر وتراخيص»: the sources the app's text, fonts and data come from.
/// Text from the draft in `docs/release/content-rights-register.md` §4, confirmed items only. The bracketed items there
/// (Qiraat book sources, nquran.com, Quranpedia, icon and banner designer) wait on the owner's answers in §5.
struct AcknowledgementsView: View {
    var body: some View {
        Form {
            Section("المصادر والشكر") {
                ForEach(Self.items.indices, id: \.self) { index in
                    Text(Self.items[index])
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("شكر وتراخيص")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("acknowledgements-view")
    }

    /// Catalog keys (Arabic), resolved in the app's language through the environment locale.
    private static let items: [LocalizedStringKey] = [
        "نص المصحف وخطوط صفحاته (QCF V2) وخط «KFGQPC Uthmanic Script HAFS»: مجمع الملك فهد لطباعة المصحف الشريف، المدينة المنورة. حقوق الخطوط محفوظة للمجمع.",
        "بيانات الكلمات وتخطيط الصفحات وخطوط الصفحات عبر Quran Foundation (Quran.com). Quran data provided by Quran.Foundation.",
        "متن الشاطبية «حرز الأماني ووجه التهاني» للإمام الشاطبي (ت ٥٩٠هـ)، ومتنا «الدرة المضية» و«طيبة النشر» للإمام ابن الجزري (ت ٨٣٣هـ)، من نسخة المكتبة الشاملة (shamela.ws).",
        "شرحا «الوافي» لعبد الفتاح القاضي و«الهادي» لمحمد سالم محيسن.",
    ]
}
