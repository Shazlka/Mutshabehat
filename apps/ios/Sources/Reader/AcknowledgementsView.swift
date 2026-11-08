import SwiftUI

/// The app's version and support address. The privacy policy and support pages live inside the app: the standalone
/// app opens no web page and needs no server.
enum LegalLinks {
    static let supportEmail = "Amr.eshazly@gmail.com"

    static var supportMail: URL { URL(string: "mailto:\(supportEmail)")! }

    /// "1.0 (12)": `CFBundleShortVersionString` and `CFBundleVersion`, wrapped in a left-to-right isolate so the
    /// parentheses stay put in an Arabic layout.
    static var appVersion: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\u{2066}\(version) (\(build))\u{2069}"
    }
}

/// Settings → «سياسة الخصوصية». The same text is published once for the App Store record's Privacy Policy URL.
struct PrivacyPolicyView: View {
    var body: some View {
        Form {
            Section {
                ForEach(Self.items.indices, id: \.self) { index in
                    Text(Self.items[index])
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("سياسة الخصوصية")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("privacy-policy-view")
    }

    private static let items: [LocalizedStringKey] = [
        "لا يجمع التطبيق أي بيانات عنك، ولا يرسل شيئًا إلى أي خادم.",
        "لا يحتاج التطبيق إلى حساب أو تسجيل دخول.",
        "يعمل التطبيق كله دون اتصال بالإنترنت؛ كل بيانات المصحف والقراءات مضمّنة فيه.",
        "إعداداتك (المظهر، اللغة، القارئ المختار، آخر صفحة) تُحفظ على جهازك فقط، وتُحذف بحذف التطبيق.",
    ]
}

/// Settings → «الدعم»: the contact address and the version.
struct SupportView: View {
    var body: some View {
        Form {
            Section {
                Text("للأسئلة والملاحظات أو للإبلاغ عن خطأ في البيانات، راسلنا على البريد:")
                    .fixedSize(horizontal: false, vertical: true)
                Link(destination: LegalLinks.supportMail) {
                    Text(verbatim: LegalLinks.supportEmail)
                        .environment(\.layoutDirection, .leftToRight)
                }
                .accessibilityIdentifier("support-email")
            }
            Section {
                LabeledContent("الإصدار") { Text(verbatim: LegalLinks.appVersion) }
            }
        }
        .navigationTitle("الدعم")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("support-view")
    }
}

/// Settings → «المصادر والشكر»: the sources the app's text, fonts and data come from.
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
        .navigationTitle("المصادر والشكر")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("acknowledgements-view")
    }

    /// Catalog keys (Arabic), resolved in the app's language through the environment locale.
    private static let items: [LocalizedStringKey] = [
        "نص المصحف وخطوط صفحاته (QCF V2) وخط «KFGQPC Uthmanic Script HAFS»: مجمع الملك فهد لطباعة المصحف الشريف، المدينة المنورة.",
        "بيانات الكلمات وتخطيط الصفحات وخطوط الصفحات عبر Quran Foundation (Quran.com). Quran data provided by Quran.Foundation.",
        "متن الشاطبية «حرز الأماني ووجه التهاني» للإمام الشاطبي (ت ٥٩٠هـ)، ومتنا «الدرة المضية» و«طيبة النشر» للإمام ابن الجزري (ت ٨٣٣هـ)، من نسخة المكتبة الشاملة (shamela.ws).",
        "شرحا «الوافي» لعبد الفتاح القاضي و«الهادي» لمحمد سالم محيسن.",
    ]
}
