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
            List {
                switch tab {
                case .surahs:
                    ForEach(library.surahs) { surah in
                        row(title: surah.name, number: surah.number, page: surah.firstPage)
                    }
                case .juz:
                    ForEach(1...30, id: \.self) { juz in
                        row(title: "الجزء \(juz)", number: juz, page: library.juzStartPages[juz] ?? 1)
                    }
                }
            }
            .listStyle(.plain)
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

    private func row(title: String, number: Int, page: Int) -> some View {
        Button { onSelect(page) } label: {
            HStack {
                Text("\(number)").monospacedDigit().foregroundStyle(.secondary).frame(width: 32)
                Text(title).font(.title3)
                Spacer()
                Text("ص \(page)").monospacedDigit().foregroundStyle(.secondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("index-row-\(title)")
    }
}
