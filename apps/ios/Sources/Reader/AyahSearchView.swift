import MushafCore
import SwiftUI

struct AyahSearchView: View {
    let library: MushafLibrary
    let selectResult: (AyahSearchResult) -> Void

    @Environment(\.dismiss) private var dismiss
    @AppStorage("app:language:v1") private var language = AppLanguage.arabic.rawValue
    @State private var query = ""
    @State private var mode = QuranSearchMode.smart
    @State private var results: [AyahSearchResult] = []
    @State private var hasSearched = false
    @State private var selectedVariant: String? = nil
    @State private var variantPills: [String] = []

    private var isArabic: Bool {
        language == AppLanguage.arabic.rawValue
    }

    private var modeDescription: String {
        switch mode {
        case .smart:
            return isArabic
                ? "البحث الذكي: يشمل الجذور والمشتقات والهمزات والأخطاء الشائعة"
                : "Smart Search: Includes roots, derivatives, hamzas, and typo tolerance"
        case .exact:
            return isArabic
                ? "البحث المطابق: يطابق نص الآية كما هي بالحرف والرسم"
                : "Exact Search: Matches the exact word or phrase letter-for-letter"
        case .broad:
            return isArabic
                ? "البحث الموسع: يشمل الصيغ المشابهة وتقارب الرسم القرآني"
                : "Broad Search: Covers similar phonetic and orthographic forms"
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Top header bar matching screenshots
                HStack {
                    Spacer()
                        .frame(width: 36) // Balance close button for centering

                    HStack(spacing: 6) {
                        Text(isArabic ? "البحث في القرآن" : "Search in Quran")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.primary)

                        Image(systemName: "chevron.down.circle.fill")
                            .font(.system(size: 15))
                            .foregroundColor(Color(uiColor: .tertiaryLabel))
                    }

                    Spacer()

                    Button(action: {
                        dismiss()
                    }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.primary)
                            .frame(width: 32, height: 32)
                            .background(Color(uiColor: .secondarySystemBackground))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("إغلاق")
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 6)
                .background(Color(uiColor: .systemGroupedBackground))

                // Content Area
                if !hasSearched && query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    AdvancedSearchGuideView(bottomPadding: 130) { selectedQuery in
                        query = selectedQuery
                        performSearch()
                    }
                } else if displayedResults.isEmpty && hasSearched {
                    VStack(spacing: 12) {
                        Spacer()
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 44))
                            .foregroundStyle(.secondary)
                        Text("لا توجد نتائج")
                            .font(.headline)
                        Text("جرّب البحث الموسع أو راجع كتابة الكلمة")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding()
                } else {
                    // Header count
                    if hasSearched || !results.isEmpty {
                        Text(isArabic ? "إجمالي الآيات في نتائج البحث: \(displayedResults.count)" : "Total verses in search results: \(displayedResults.count)")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 6)
                            .padding(.bottom, 6)
                    }

                    ScrollView {
                        LazyVStack(spacing: 18) {
                            ForEach(displayedResults) { result in
                                QuranSearchResultCard(
                                    result: result,
                                    query: query,
                                    surahName: library.surahNames[result.ayah.surah] ?? "",
                                    select: { selectResult(result) }
                                )
                                Divider()
                                    .padding(.horizontal, 20)
                                    .opacity(0.6)
                            }
                        }
                        .padding(.top, 8)
                        .padding(.bottom, 130) // Space for bottom floating bar
                    }
                }
            }

            // Floating Bottom Bar (Pills + Search Input)
            VStack(spacing: 8) {
                // Search mode picker for accessibility and search customization
                Picker("نمط البحث", selection: $mode) {
                    Text("ذكي").tag(QuranSearchMode.smart)
                    Text("مطابق").tag(QuranSearchMode.exact)
                    Text("موسع").tag(QuranSearchMode.broad)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("search-mode")
                .padding(.horizontal, 20)
                .onChange(of: mode) { _ in
                    performSearch()
                }

                Text(modeDescription)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.horizontal, 20)

                // Horizontal Pills Row
                if !variantPills.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(variantPills, id: \.self) { pill in
                                Button {
                                    if selectedVariant == pill {
                                        selectedVariant = nil
                                    } else {
                                        selectedVariant = pill
                                    }
                                } label: {
                                    Text(pill)
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundColor(selectedVariant == pill ? .white : Color(red: 0.08, green: 0.40, blue: 0.20))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 6)
                                        .background(
                                            Capsule()
                                                .fill(selectedVariant == pill
                                                      ? Color(red: 0.13, green: 0.55, blue: 0.30)
                                                      : Color(red: 0.82, green: 0.95, blue: 0.86))
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .environment(\.layoutDirection, .rightToLeft)
                }

                // Search Capsule
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                        .font(.system(size: 16))

                    TextField(isArabic ? "ابحث في القرآن الكريم..." : "Search the Holy Quran...", text: $query)
                        .textFieldStyle(.plain)
                        .font(.system(size: 16))
                        .environment(\.layoutDirection, isArabic || !query.isEmpty ? .rightToLeft : .leftToRight)
                        .submitLabel(.search)
                        .onSubmit(performSearch)
                        .accessibilityIdentifier("search-field")

                    if !query.isEmpty {
                        Button {
                            query = ""
                            results = []
                            hasSearched = false
                            selectedVariant = nil
                            variantPills = []
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                                .font(.system(size: 16))
                        }
                        .buttonStyle(.plain)
                    }

                    Button(action: performSearch) {
                        Image(systemName: "arrow.up.circle.fill")
                            .foregroundColor(.accentColor)
                            .font(.system(size: 22))
                    }
                    .accessibilityIdentifier("search-submit")
                    .accessibilityLabel("بحث")

                    Divider()
                        .frame(height: 18)

                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.primary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(
                    Capsule()
                        .fill(Color(uiColor: .systemBackground))
                        .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
                        .overlay(
                            Capsule()
                                .stroke(Color.gray.opacity(0.25), lineWidth: 1)
                        )
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
            }
            .padding(.top, 8)
            .background(
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .ignoresSafeArea(edges: .bottom)
            )
        }
        .onChange(of: query) { newQuery in
            if newQuery.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 {
                performSearch()
            } else if newQuery.isEmpty {
                results = []
                hasSearched = false
                variantPills = []
                selectedVariant = nil
            }
        }
    }

    private var displayedResults: [AyahSearchResult] {
        guard let selectedVariant else { return results }
        return results.filter { result in
            let plain = QuranSearchNormalizer.plain(result.text)
                .replacingOccurrences(of: "ءا", with: "آ")
                .replacingOccurrences(of: "ءـ", with: "آ")
                .replacingOccurrences(of: "ء", with: "آ")
            return plain.contains(selectedVariant)
        }
    }

    private func performSearch() {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            results = []
            hasSearched = false
            variantPills = []
            selectedVariant = nil
            return
        }

        let rawResults = library.searchAyaat(matching: query, mode: mode)

        // Rank results: exact root/unprefixed matches first, followed by surah/ayah order
        let cleanQ = QuranSearchNormalizer.canonical(QuranSearchNormalizer.plain(query))
        let sorted = rawResults.sorted { a, b in
            let aPlain = QuranSearchNormalizer.plain(a.uthmaniWord)
            let bPlain = QuranSearchNormalizer.plain(b.uthmaniWord)
            let aClean = QuranSearchNormalizer.canonical(aPlain)
            let bClean = QuranSearchNormalizer.canonical(bPlain)

            let aExact = aClean == cleanQ
            let bExact = bClean == cleanQ
            if aExact != bExact { return aExact }

            let aPrefixed = aPlain.hasPrefix("ال") || aPlain.hasPrefix("وال") || aPlain.hasPrefix("بال") || aPlain.hasPrefix("و") || aPlain.hasPrefix("ف") || aPlain.hasPrefix("ل") || aPlain.hasPrefix("ب")
            let bPrefixed = bPlain.hasPrefix("ال") || bPlain.hasPrefix("وال") || bPlain.hasPrefix("بال") || bPlain.hasPrefix("و") || bPlain.hasPrefix("ف") || bPlain.hasPrefix("ل") || bPlain.hasPrefix("ب")
            if aPrefixed != bPrefixed { return !aPrefixed }

            if a.ayah.surah != b.ayah.surah {
                return a.ayah.surah < b.ayah.surah
            }
            return a.ayah.ayah < b.ayah.ayah
        }

        results = sorted
        hasSearched = true
        selectedVariant = nil
        variantPills = extractVariantPills(from: sorted, query: query)
    }

    private func extractVariantPills(from results: [AyahSearchResult], query: String) -> [String] {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }
        let cleanQuery = QuranSearchNormalizer.canonical(QuranSearchNormalizer.plain(query))

        var seen = Set<String>()
        var list: [String] = []

        for result in results {
            let words = result.text.split(separator: " ")
            for wordSub in words {
                let word = String(wordSub)
                let cleanWord = QuranSearchNormalizer.canonical(QuranSearchNormalizer.plain(word))
                if cleanWord == cleanQuery || cleanWord.contains(cleanQuery) || (!cleanWord.isEmpty && cleanQuery.contains(cleanWord) && cleanWord.count > 2) {
                    let plain = QuranSearchNormalizer.plain(word)
                    let display = plain
                        .replacingOccurrences(of: "ءا", with: "آ")
                        .replacingOccurrences(of: "ءـ", with: "آ")
                        .replacingOccurrences(of: "ء", with: "آ")
                        .trimmingCharacters(in: .whitespacesAndNewlines)

                    if !display.isEmpty && !seen.contains(display) {
                        seen.insert(display)
                        list.append(display)
                    }
                }
            }
        }

        return list.sorted { a, b in
            let aPrefixed = a.hasPrefix("ال") || a.hasPrefix("وال") || a.hasPrefix("بال")
            let bPrefixed = b.hasPrefix("ال") || b.hasPrefix("وال") || b.hasPrefix("بال")
            if aPrefixed != bPrefixed { return !aPrefixed }
            if a.count != b.count { return a.count < b.count }
            return a < b
        }
    }
}

// MARK: - Search Result Card

private struct QuranSearchResultCard: View {
    let result: AyahSearchResult
    let query: String
    let surahName: String
    let select: () -> Void

    private var surahTitle: String {
        vocalizedSurahNames[result.ayah.surah] ?? "سُورَةُ \(surahName)"
    }

    var body: some View {
        VStack(spacing: 12) {
            // Header Pill
            HStack {
                ShareLink(item: "\(result.text)\n\n[\(surahTitle) - آية \(result.ayah.ayah)]") {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 15))
                        .foregroundStyle(.secondary)
                        .padding(6)
                }

                Spacer()

                Text(surahTitle)
                    .font(surahHeaderFont)
                    .foregroundColor(Color(red: 0.58, green: 0.38, blue: 0.18)) // Bronze/gold

                Spacer()

                HStack(spacing: 5) {
                    Text("\(result.ayah.ayah)")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)

                    Image(systemName: "book.pages")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
                .padding(6)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .stroke(Color.gray.opacity(0.22), lineWidth: 1)
            )
            .padding(.horizontal, 16)

            // Ayah Quran Text Button
            Button(action: select) {
                Text(highlightedAyah(text: result.text, query: query, uthmaniWord: result.uthmaniWord))
                    .multilineTextAlignment(.center)
                    .lineSpacing(12)
                    .environment(\.layoutDirection, .rightToLeft)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("search-result-\(result.ayah.description)")
        }
        .frame(maxWidth: .infinity)
    }

    private var quranFont: Font {
        let font = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: 24)
            ?? UIFont(name: "Amiri", size: 24)
            ?? UIFont.systemFont(ofSize: 24)
        return Font(font)
    }

    private var surahHeaderFont: Font {
        let font = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: 21)
            ?? UIFont(name: "Amiri", size: 21)
            ?? UIFont.systemFont(ofSize: 21, weight: .bold)
        return Font(font)
    }

    private func highlightedAyah(text: String, query: String, uthmaniWord: String) -> AttributedString {
        var attributed = AttributedString(text)
        attributed.font = quranFont
        attributed.foregroundColor = Color.primary

        let highlightColor = Color(red: 0.74, green: 0.44, blue: 0.15) // Amber/bronze matching photo

        let words = text.split(separator: " ")
        let cleanQuery = QuranSearchNormalizer.canonical(QuranSearchNormalizer.plain(query))

        for wordSub in words {
            let word = String(wordSub)
            let cleanWord = QuranSearchNormalizer.canonical(QuranSearchNormalizer.plain(word))

            let isMatch: Bool
            if !cleanQuery.isEmpty && (cleanWord == cleanQuery || cleanWord.contains(cleanQuery) || (cleanQuery.contains(cleanWord) && cleanWord.count > 2)) {
                isMatch = true
            } else if !uthmaniWord.isEmpty && (word == uthmaniWord || word.contains(uthmaniWord) || uthmaniWord.contains(word)) {
                isMatch = true
            } else {
                isMatch = false
            }

            if isMatch {
                var searchRange = attributed.startIndex..<attributed.endIndex
                while let range = attributed[searchRange].range(of: word) {
                    attributed[range].foregroundColor = highlightColor
                    if range.upperBound < attributed.endIndex {
                        searchRange = range.upperBound..<attributed.endIndex
                    } else {
                        break
                    }
                }
            }
        }

        return attributed
    }
}

// MARK: - Vocalized Surah Names (1..114)

private let vocalizedSurahNames: [Int: String] = [
    1: "سُورَةُ الفَاتِحَةِ",
    2: "سُورَةُ البَقَرَةِ",
    3: "سُورَةُ آلِ عِمْرَانَ",
    4: "سُورَةُ النِّسَاءِ",
    5: "سُورَةُ المَائِدَةِ",
    6: "سُورَةُ الأَنْعَامِ",
    7: "سُورَةُ الأَعْرَافِ",
    8: "سُورَةُ الأَنْفَالِ",
    9: "سُورَةُ التَّوْبَةِ",
    10: "سُورَةُ يُونُسَ",
    11: "سُورَةُ هُودٍ",
    12: "سُورَةُ يُوسُفَ",
    13: "سُورَةُ الرَّعْدِ",
    14: "سُورَةُ إِبْرَاهِيمَ",
    15: "سُورَةُ الحِجْرِ",
    16: "سُورَةُ النَّحْلِ",
    17: "سُورَةُ الإِسْرَاءِ",
    18: "سُورَةُ الكَهْفِ",
    19: "سُورَةُ مَرْيَمَ",
    20: "سُورَةُ طه",
    21: "سُورَةُ الأَنْبِيَاءِ",
    22: "سُورَةُ الحَجِّ",
    23: "سُورَةُ المُؤْمِنُونَ",
    24: "سُورَةُ النُّورِ",
    25: "سُورَةُ الفُرْقَانِ",
    26: "سُورَةُ الشُّعَرَاءِ",
    27: "سُورَةُ النَّمْلِ",
    28: "سُورَةُ القَصَصِ",
    29: "سُورَةُ العَنْكَبُوتِ",
    30: "سُورَةُ الرُّومِ",
    31: "سُورَةُ لُقْمَانَ",
    32: "سُورَةُ السَّجْدَةِ",
    33: "سُورَةُ الأَحْزَابِ",
    34: "سُورَةُ سَبَإٍ",
    35: "سُورَةُ فَاطِرٍ",
    36: "سُورَةُ يس",
    37: "سُورَةُ الصَّافَّاتِ",
    38: "سُورَةُ ص",
    39: "سُورَةُ الزُّمَرِ",
    40: "سُورَةُ غَافِرٍ",
    41: "سُورَةُ فُصِّلَتْ",
    42: "سُورَةُ الشُّورَى",
    43: "سُورَةُ الزُّخْرُفِ",
    44: "سُورَةُ الدُّخَانِ",
    45: "سُورَةُ الجَاثِيَةِ",
    46: "سُورَةُ الأَحْقَافِ",
    47: "سُورَةُ مُحَمَّدٍ",
    48: "سُورَةُ الفَتْحِ",
    49: "سُورَةُ الحُجُرَاتِ",
    50: "سُورَةُ ق",
    51: "سُورَةُ الذَّارِيَاتِ",
    52: "سُورَةُ الطُّورِ",
    53: "سُورَةُ النَّجْمِ",
    54: "سُورَةُ القَمَرِ",
    55: "سُورَةُ الرَّحْمَٰنِ",
    56: "سُورَةُ الوَاقِعَةِ",
    57: "سُورَةُ الحَدِيدِ",
    58: "سُورَةُ المُجَادَلَةِ",
    59: "سُورَةُ الحَشْرِ",
    60: "سُورَةُ المُمْتَحَنَةِ",
    61: "سُورَةُ الصَّفِّ",
    62: "سُورَةُ الجُمُعَةِ",
    63: "سُورَةُ المُنَافِقُونَ",
    64: "سُورَةُ التَّغَابُنِ",
    65: "سُورَةُ الطَّلَاقِ",
    66: "سُورَةُ التَّحْرِيمِ",
    67: "سُورَةُ المُلْكِ",
    68: "سُورَةُ القَلَمِ",
    69: "سُورَةُ الحَاقَّةِ",
    70: "سُورَةُ المَعَارِجِ",
    71: "سُورَةُ نُوحٍ",
    72: "سُورَةُ الجِنِّ",
    73: "سُورَةُ المُزَّمِّلِ",
    74: "سُورَةُ المُدَّثِّرِ",
    75: "سُورَةُ القِيَامَةِ",
    76: "سُورَةُ الإِنْسَانِ",
    77: "سُورَةُ المُرْسَلَاتِ",
    78: "سُورَةُ النَّبَإِ",
    79: "سُورَةُ النَّازِعَاتِ",
    80: "سُورَةُ عَبَسَ",
    81: "سُورَةُ التَّكْوِيرِ",
    82: "سُورَةُ الانْفِطَارِ",
    83: "سُورَةُ المُطَفِّفِينَ",
    84: "سُورَةُ الانْشِقَاقِ",
    85: "سُورَةُ البُرُوجِ",
    86: "سُورَةُ الطَّارِقِ",
    87: "سُورَةُ الأَعْلَى",
    88: "سُورَةُ الغَاشِيَةِ",
    89: "سُورَةُ الفَجْرِ",
    90: "سُورَةُ البَلَدِ",
    91: "سُورَةُ الشَّمْسِ",
    92: "سُورَةُ اللَّيْلِ",
    93: "سُورَةُ الضُّحَى",
    94: "سُورَةُ الشَّرْحِ",
    95: "سُورَةُ التِّينِ",
    96: "سُورَةُ العَلَقِ",
    97: "سُورَةُ القَدْرِ",
    98: "سُورَةُ البَيِّنَةِ",
    99: "سُورَةُ الزَّلْزَلَةِ",
    100: "سُورَةُ العَادِيَاتِ",
    101: "سُورَةُ القَارِعَةِ",
    102: "سُورَةُ التَّكَاثُرِ",
    103: "سُورَةُ العَصْرِ",
    104: "سُورَةُ الهُمَزَةِ",
    105: "سُورَةُ الفِيلِ",
    106: "سُورَةُ قُرَيْشٍ",
    107: "سُورَةُ المَاعُونِ",
    108: "سُورَةُ الكَوْثَرِ",
    109: "سُورَةُ الكَافِرُونَ",
    110: "سُورَةُ النَّصْرِ",
    111: "سُورَةُ المَسَدِ",
    112: "سُورَةُ الإِخْلَاصِ",
    113: "سُورَةُ الفَلَقِ",
    114: "سُورَةُ النَّاسِ"
]
