import MushafCore
import SwiftUI

struct IndexSheet: View {
    enum Tab: String, CaseIterable { case surahs = "السور", juz = "الأجزاء" }

    let library: MushafLibrary
    let currentPage: Int
    let onSelect: (Int) -> Void
    @State private var tab = Tab.surahs

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    switch tab {
                    case .surahs:
                        ForEach(library.surahs) { surah in
                            row(title: surah.name, number: surah.number, page: surah.firstPage,
                                isCurrent: containsCurrentPage(surah))
                                .id(surah.number)
                        }
                    case .juz:
                        ForEach(1...30, id: \.self) { juz in
                            row(title: "الجزء \(juz)", number: juz, page: library.juzStartPages[juz] ?? 1,
                                isCurrent: juz == currentJuz)
                                .id(juz)
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
                        ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 220)
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
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
        }
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
