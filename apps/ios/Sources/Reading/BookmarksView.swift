import MushafCore
import SwiftUI

struct BookmarksView: View {
    let library: MushafLibrary
    let onSelectBookmark: (QuranBookmark) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var tracker = ReadingTracker.shared
    @State private var filter: BookmarkFilter = .all
    @State private var searchQuery: String = ""
    @State private var bookmarks: [QuranBookmark] = []

    enum BookmarkFilter: CaseIterable {
        case all
        case ayahs
        case pages

        var title: String {
            switch self {
            case .all: "الكل"
            case .ayahs: "الآيات"
            case .pages: "الصفحات"
            }
        }

        var bookmarkType: BookmarkType? {
            switch self {
            case .all: nil
            case .ayahs: .ayah
            case .pages: .page
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter picker & search bar
                VStack(spacing: 10) {
                    Picker("تصفية", selection: $filter) {
                        ForEach(BookmarkFilter.allCases, id: \.self) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)

                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("بحث في الفواصل...", text: $searchQuery)
                            .environment(\.layoutDirection, .rightToLeft)
                        if !searchQuery.isEmpty {
                            Button {
                                searchQuery = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(8)
                    .background(Color(uiColor: .secondarySystemBackground))
                    .cornerRadius(10)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                Divider()

                if bookmarks.isEmpty {
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "bookmark")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        Text("لا توجد فواصل محفوظة")
                            .font(.headline)
                            .foregroundColor(.primary)
                        Text("لحفظ فاصل، اضغط مطولاً على رقم الآية في المصحف")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        Spacer()
                    }
                } else {
                    List {
                        ForEach(bookmarks) { bookmark in
                            Button {
                                onSelectBookmark(bookmark)
                                dismiss()
                            } label: {
                                BookmarkCard(bookmark: bookmark, library: library)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    deleteBookmark(bookmark)
                                } label: {
                                    Label("حذف", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("الفواصل")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }
                }
            }
            .onAppear(perform: loadBookmarks)
            .onChange(of: filter) { _, _ in loadBookmarks() }
            .onChange(of: searchQuery) { _, _ in loadBookmarks() }
        }
    }

    private func loadBookmarks() {
        bookmarks = tracker.allBookmarks(type: filter.bookmarkType, query: searchQuery)
    }

    private func deleteBookmark(_ bookmark: QuranBookmark) {
        tracker.removeBookmark(id: bookmark.id)
        loadBookmarks()
    }
}

private struct BookmarkCard: View {
    let bookmark: QuranBookmark
    let library: MushafLibrary

    private var surahName: String {
        library.surahNames[bookmark.surah] ?? "سورة \(bookmark.surah)"
    }

    private var dateFormatted: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = Locale(identifier: "ar")
        return f.string(from: bookmark.createdAt)
    }

    private var ayahPreview: String? {
        guard let mushafPage = library.page(bookmark.page) else { return nil }
        for line in mushafPage.lines {
            for word in line.words {
                if word.ayahKey.surah == bookmark.surah && word.ayahKey.ayah == bookmark.ayah {
                    // Collect up to first 8 words of this ayah
                    let words = mushafPage.lines
                        .flatMap(\.words)
                        .filter { $0.ayahKey.surah == bookmark.surah && $0.ayahKey.ayah == bookmark.ayah && $0.charType == .word }
                        .prefix(8)
                        .map(\.textUthmani)
                    return words.joined(separator: " ") + (words.count >= 8 ? "..." : "")
                }
            }
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                // Surah & Ayah / Page badge
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(surahName)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(.primary)

                        Text("•")
                            .foregroundColor(.secondary)

                        if bookmark.type == .ayah {
                            Text("آية \(toArabicDigits(bookmark.ayah))")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(Color.accentColor)
                        }

                        Text("•")
                            .foregroundColor(.secondary)

                        Text("صفحة \(toArabicDigits(bookmark.page))")
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                    }

                    Text(dateFormatted)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Type badge
                Text(bookmark.type.title)
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(bookmark.type == .ayah ? Color.accentColor.opacity(0.12) : Color.orange.opacity(0.12))
                    .foregroundColor(bookmark.type == .ayah ? Color.accentColor : Color.orange)
                    .clipShape(Capsule())
            }

            // Short ayah preview
            if let preview = ayahPreview, !preview.isEmpty {
                Text(preview)
                    .font(.custom("KFGQPCUthmanicScriptHAFS", size: 18, relativeTo: .body))
                    .foregroundColor(.primary)
                    .environment(\.layoutDirection, .rightToLeft)
                    .lineLimit(2)
                    .padding(.top, 2)
            }

            if let note = bookmark.note, !note.isEmpty {
                Text(note)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, 6)
    }

    private func toArabicDigits(_ number: Int) -> String {
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        return String(number).compactMap { digits[String($0)] }.joined()
    }
}
