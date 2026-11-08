import MushafCore
import SwiftUI
import UIKit

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var theme: String
    @Binding var language: String
    @Binding var keepScreenAwake: Bool
    @Binding var autoHidesFooter: Bool
    @Bindable var qiraat: QiraatPreferences
    let library: MushafLibrary
    let onSelectPage: (Int) -> Void
    @State private var showingQiraatPicker = false
    @AppStorage(LandscapeView.storageKey) private var landscapeView = LandscapeView.reading.rawValue
    @AppStorage(SurahBannerStyle.storageKey) private var bannerStyle = SurahBannerStyle.royal.rawValue

    private var appLanguage: AppLanguage {
        AppLanguage(rawValue: language) ?? .deviceDefault
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(appLanguage == .english ? "Reading" : "القراءة") {
                    Toggle(
                        appLanguage == .english ? "Keep Screen Awake" : "إبقاء الشاشة مضاءة أثناء القراءة",
                        isOn: $keepScreenAwake
                    )
                    .tint(.switchOn)
                    .accessibilityIdentifier("keep-screen-awake-toggle")

                    Toggle(
                        appLanguage == .english ? "Hide the footer after 10 seconds" : "إخفاء الشريط السفلي تلقائيًا بعد ١٠ ثوانٍ",
                        isOn: $autoHidesFooter
                    )
                    .tint(.switchOn)
                    .accessibilityIdentifier("auto-hide-footer-toggle")
                }

                if library.qiraat?.catalog != nil {
                    Section(appLanguage == .english ? "Ten Qira'at" : "القراءات العشر") {
                        QiraatToggle(isOn: $qiraat.enabled)
                        Button {
                            showingQiraatPicker = true
                        } label: {
                            Label(
                                appLanguage == .english ? "Choose Reader or Narrator" : "اختيار القارئ أو الراوي",
                                systemImage: "person.2.fill"
                            )
                        }
                        .disabled(!qiraat.enabled)
                        .accessibilityIdentifier("open-qiraat-picker")
                        Toggle(
                            appLanguage == .english ? "Farsh only (hide Usul)" : "فرش الحروف فقط (إخفاء الأصول)",
                            isOn: $qiraat.hidesUsul
                        )
                        .tint(.switchOn)
                        .disabled(!qiraat.enabled)
                        .accessibilityIdentifier("qiraat-hide-usul-toggle")
                        NavigationLink {
                            UsulCategoriesSettingsView(qiraat: qiraat, library: library, language: appLanguage)
                        } label: {
                            HStack {
                                Label(appLanguage == .english ? "Usul categories" : "أبواب الأصول",
                                      systemImage: "books.vertical")
                                Spacer()
                                if !qiraat.hiddenUsulCategories.isEmpty {
                                    Text(appLanguage == .english
                                         ? "\(qiraat.hiddenUsulCategories.count) hidden"
                                         : "\(qiraat.hiddenUsulCategories.count) مخفية")
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .disabled(!qiraat.enabled || qiraat.hidesUsul)
                        .accessibilityIdentifier("open-qiraat-usul-categories")
                    }
                } else {
                    // The Qiraat data failed to load (a damaged install or import). Hiding the whole section made that
                    // look like a build without the feature, so say it.
                    Section(appLanguage == .english ? "Ten Qira'at" : "القراءات العشر") {
                        Label(appLanguage == .english ? "Could not load the Qiraat data" : "تعذّر تحميل بيانات القراءات",
                              systemImage: "exclamationmark.triangle")
                            .accessibilityIdentifier("qiraat-data-unavailable")
                    }
                }
                Section(appLanguage == .english ? "Preferences" : "التفضيلات") {
                    NavigationLink {
                        ThemeSettingsView(theme: $theme)
                    } label: {
                        Label(appLanguage == .english ? "Appearance" : "المظهر", systemImage: "circle.lefthalf.filled")
                    }
                    .accessibilityIdentifier("open-theme-settings")

                    NavigationLink {
                        SurahBannerSettingsView(style: $bannerStyle, language: appLanguage)
                    } label: {
                        Label(appLanguage == .english ? "Surah banner" : "شكل ترويسة السورة",
                              systemImage: "rectangle.inset.filled")
                    }
                    .accessibilityIdentifier("open-surah-banner-settings")

                    NavigationLink {
                        LanguageSettingsView(language: $language)
                    } label: {
                        Label(appLanguage == .english ? "Language" : "اللغة", systemImage: "globe")
                    }
                    .accessibilityIdentifier("open-language-settings")
                }
                if UIDevice.current.userInterfaceIdiom == .pad {
                    Section {
                        Picker(selection: $landscapeView) {
                            Text(appLanguage == .english ? "Reading" : "قراءة").tag(LandscapeView.reading.rawValue)
                            Text(appLanguage == .english ? "Learning" : "تعلّم").tag(LandscapeView.learning.rawValue)
                        } label: {
                            Label(appLanguage == .english ? "Landscape view" : "العرض الأفقي",
                                  systemImage: "rectangle.split.2x1")
                        }
                        .accessibilityIdentifier("landscape-view-picker")
                    } footer: {
                        Text(appLanguage == .english
                             ? "Reading shows two facing pages. Learning shows one page, with the Qira'at of the word you tap in a side bar."
                             : "القراءة: صفحتان متقابلتان. التعلّم: صفحة واحدة، وقراءات الكلمة التي تضغطها في شريط جانبي.")
                    }
                }
                Section("الخصوصية والدعم") {
                    NavigationLink {
                        PrivacyPolicyView()
                    } label: {
                        Label("سياسة الخصوصية", systemImage: "hand.raised.fill")
                    }
                    .accessibilityIdentifier("open-privacy-policy")

                    NavigationLink {
                        SupportView()
                    } label: {
                        Label("الدعم", systemImage: "questionmark.circle")
                    }
                    .accessibilityIdentifier("open-support")

                    NavigationLink {
                        AcknowledgementsView()
                    } label: {
                        Label("المصادر والشكر", systemImage: "text.book.closed")
                    }
                    .accessibilityIdentifier("open-acknowledgements")
                }

                Section {
                    LabeledContent("الإصدار") {
                        Text(verbatim: LegalLinks.appVersion)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Text("الإصدار \(LegalLinks.appVersion)"))
                    .accessibilityIdentifier("app-version")
                }
            }
            .sheet(isPresented: $showingQiraatPicker) {
                if let catalog = library.qiraat?.catalog {
                    QiraatReaderPicker(catalog: catalog, selection: $qiraat.filter)
                }
            }
            .navigationTitle("الإعدادات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("تم") { dismiss() }
                }
            }
        }
    }
}

struct ThemeSettingsView: View {
    @Binding var theme: String

    var body: some View {
        List(MushafAppearance.allCases) { option in
            Button {
                theme = option.rawValue
            } label: {
                HStack {
                    Text(option.title)
                    Spacer()
                    if theme == option.rawValue {
                        Image(systemName: "checkmark")
                    }
                }
            }
            .accessibilityIdentifier("theme-\(option.rawValue)")
        }
        .navigationTitle("المظهر")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct LanguageSettingsView: View {
    @Binding var language: String

    var body: some View {
        List(AppLanguage.allCases) { option in
            Button {
                language = option.rawValue
            } label: {
                HStack {
                    Text(option.title)
                    Spacer()
                    if language == option.rawValue {
                        Image(systemName: "checkmark")
                    }
                }
            }
            .accessibilityIdentifier("language-\(option.rawValue)")
        }
        .navigationTitle("اللغة")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One switch per أصول باب: off hides that باب's marks, cards, search results, key row and index entries.
struct UsulCategoriesSettingsView: View {
    @Bindable var qiraat: QiraatPreferences
    let library: MushafLibrary
    let language: AppLanguage
    @State private var categories: [QiraatUsulCategory]?

    private var isEnglish: Bool { language == .english }

    var body: some View {
        Form {
            Section {
                if let categories {
                    if categories.isEmpty {
                        Text(isEnglish ? "No Usul categories in the installed data." : "لا توجد أبواب أصول في البيانات المثبّتة.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(categories) { category in
                            Toggle(isOn: Binding(
                                get: { !qiraat.hiddenUsulCategories.contains(category.code) },
                                set: { qiraat.setUsul(category.code, shown: $0) }
                            )) {
                                HStack(spacing: 8) {
                                    Circle().fill(Color(qiraatHex: category.color)).frame(width: 10, height: 10)
                                    Text(category.nameAr)
                                }
                            }
                            .tint(.switchOn)
                            .accessibilityIdentifier("qiraat-usul-toggle-\(category.code)")
                        }
                    }
                } else {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text(isEnglish ? "Loading categories…" : "جارٍ تحميل الأبواب…").foregroundStyle(.secondary)
                    }
                }
            } footer: {
                Text(isEnglish
                     ? "Turn a category off to hide its marks, cards and search results. \"Farsh only\" hides all of them."
                     : "أغلق البابَ لإخفاء علاماته وبطاقاته ونتائج البحث عنه. خيار «فرش فقط» يخفي الأبواب كلها.")
            }
        }
        .navigationTitle(isEnglish ? "Usul categories" : "أبواب الأصول")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard categories == nil, let store = library.qiraat else { return }
            let found = await Task.detached(priority: .utility) { store.usulCategories() }.value
            // First-seen order shifts whenever a live page arrives; a fixed alphabetical order keeps the list still.
            categories = found.sorted { $0.nameAr.localizedStandardCompare($1.nameAr) == .orderedAscending }
        }
    }
}
