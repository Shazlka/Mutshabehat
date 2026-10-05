import MushafCore
import SwiftUI

struct IndexSheet: View {
    enum Tab: CaseIterable {
        case surahs
        case juz
        case bookmarks

        var title: LocalizedStringKey {
            switch self {
            case .surahs: "السور"
            case .juz: "الأجزاء"
            case .bookmarks: "الفواصل"
            }
        }
    }

    let library: MushafLibrary
    let currentPage: Int
    let onSelect: (Int) -> Void
    @StateObject private var tracker = ReadingTracker.shared
    @State private var tab = Tab.surahs
    @State private var surahFilter = SurahProgressFilter.all

    private var displayedSurahs: [Surah] {
        switch surahFilter {
        case .all:
            return library.surahs
        case .remaining:
            return library.surahs.filter { surah in
                let p = tracker.surahProgress(surahNumber: surah.number, totalAyahs: surah.ayahCount)
                return !p.isCompleted
            }
        case .completed:
            return library.surahs.filter { surah in
                let p = tracker.surahProgress(surahNumber: surah.number, totalAyahs: surah.ayahCount)
                return p.isCompleted
            }
        case .started:
            return library.surahs.filter { surah in
                let p = tracker.surahProgress(surahNumber: surah.number, totalAyahs: surah.ayahCount)
                return p.isStarted
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    switch tab {
                    case .surahs:
                        Section {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(SurahProgressFilter.allCases) { f in
                                        Button {
                                            withAnimation(.easeInOut(duration: 0.15)) {
                                                surahFilter = f
                                            }
                                        } label: {
                                            Text(f.title)
                                                .font(.caption.bold())
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 6)
                                                .background(surahFilter == f ? Color.green : Color(uiColor: .tertiarySystemFill))
                                                .foregroundColor(surahFilter == f ? .white : .primary)
                                                .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowBackground(Color.clear)

                            ForEach(displayedSurahs) { surah in
                                surahRow(surah: surah, isCurrent: containsCurrentPage(surah))
                                    .id(surah.number)
                            }
                        }
                    case .juz:
                        ForEach(1...30, id: \.self) { juz in
                            row(title: "الجزء \(juz)", number: juz, page: library.juzStartPages[juz] ?? 1,
                                isCurrent: juz == currentJuz)
                                .id(juz)
                        }
                    case .bookmarks:
                        let all = tracker.allBookmarks()
                        if all.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "bookmark")
                                    .font(.system(size: 36))
                                    .foregroundColor(.secondary)
                                Text("لا توجد فواصل محفوظة")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 32)
                        } else {
                            ForEach(all) { bookmark in
                                Button {
                                    onSelect(bookmark.page)
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(library.surahNames[bookmark.surah] ?? "سورة \(bookmark.surah)")
                                                .font(.headline)
                                            HStack(spacing: 6) {
                                                if bookmark.type == .ayah {
                                                    Text("آية \(bookmark.ayah)")
                                                        .font(.caption.bold())
                                                        .foregroundColor(.accentColor)
                                                }
                                                Text("صفحة \(bookmark.page)")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                            }
                                        }
                                        Spacer()
                                        Text(bookmark.type.title)
                                            .font(.caption2.bold())
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(Color.accentColor.opacity(0.12))
                                            .foregroundColor(.accentColor)
                                            .clipShape(Capsule())
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .id(tab)
                .onAppear {
                    if let currentRow { proxy.scrollTo(currentRow, anchor: .center) }
                }
                .onChange(of: currentPage) { _, _ in
                    if let currentRow { proxy.scrollTo(currentRow, anchor: .center) }
                }
            }
            .navigationTitle("الفهرس")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("", selection: $tab) {
                        ForEach(Tab.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 270)
                }
            }
        }
    }

    private func containsCurrentPage(_ surah: Surah) -> Bool {
        surah.firstPage <= currentPage && currentPage <= surah.lastPage
    }

    private var currentJuz: Int? {
        library.juzStartPages.filter { $0.value <= currentPage }.max { $0.value < $1.value }?.key
    }

    private var currentRow: Int? {
        switch tab {
        case .surahs: library.surahs.first(where: containsCurrentPage)?.number
        case .juz: currentJuz
        case .bookmarks: nil
        }
    }

    private func surahRow(surah: Surah, isCurrent: Bool) -> some View {
        let progress = tracker.surahProgress(surahNumber: surah.number, totalAyahs: surah.ayahCount)
        let readCount = progress.readAyahsCount
        let pct = progress.percentage

        let targetPage = tracker.nextUnreadPage(for: surah, library: library)
        return Button { onSelect(targetPage) } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(verbatim: String(surah.number)).monospacedDigit().foregroundStyle(.secondary).frame(width: 32, alignment: .leading)
                    Text(surah.name).font(.title3)
                    if isCurrent {
                        Image(systemName: "checkmark").foregroundStyle(Color.accentColor).accessibilityHidden(true)
                    }
                    if progress.isCompleted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(.green)
                    }
                    Spacer()
                    Text(verbatim: "ص \(surah.firstPage)").monospacedDigit().foregroundStyle(.secondary)
                }

                if readCount > 0 {
                    HStack(spacing: 8) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color(uiColor: .tertiarySystemFill))
                                    .frame(height: 4)
                                Capsule()
                                    .fill(pct >= 100 ? Color.green : Color.accentColor)
                                    .frame(width: max(0, min(geo.size.width, geo.size.width * CGFloat(pct / 100.0))), height: 4)
                            }
                        }
                        .frame(height: 4)

                        if progress.isCompleted {
                            Text("مكتملة • \(Int(pct))%")
                                .font(.caption2.bold())
                                .foregroundStyle(.green)
                        } else {
                            Text("\(readCount)/\(surah.ayahCount) • المتبقي: \(progress.remainingAyahsCount)")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.leading, 34)
                } else if surahFilter == .remaining {
                    HStack {
                        Text("لم تُقرأ بعد • المتبقي: \(surah.ayahCount) آية")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.leading, 34)
                }
            }
            .contentShape(Rectangle())
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
        .listRowBackground(isCurrent ? Color.accentColor.opacity(0.12) : Color.clear)
        .accessibilityAddTraits(isCurrent ? .isSelected : [])
        .accessibilityIdentifier("index-row-\(surah.name)")
    }

    private func row(title: String, number: Int, page: Int, isCurrent: Bool) -> some View {
        Button { onSelect(page) } label: {
            HStack {
                Text(verbatim: String(number)).monospacedDigit().foregroundStyle(.secondary).frame(width: 32)
                Text(title).font(.title3)
                if isCurrent {
                    Image(systemName: "checkmark").foregroundStyle(Color.accentColor).accessibilityHidden(true)
                }
                Spacer()
                Text(verbatim: "ص \(page)").monospacedDigit().foregroundStyle(.secondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(isCurrent ? Color.accentColor.opacity(0.12) : Color.clear)
        .accessibilityAddTraits(isCurrent ? .isSelected : [])
        .accessibilityIdentifier("index-row-\(title)")
    }
}
