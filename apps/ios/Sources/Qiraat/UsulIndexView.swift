import MushafCore
import SwiftUI
import UIKit

/// An index of all 23 أصول categories (أبواب الأصول) and their occurrences across the Mushaf.
struct UsulIndexView: View {
    let categories: [UsulCategory]
    let surahNames: [Int: String]?
    let onOpen: (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void
    let onClose: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var searchText: String = ""

    init(
        categories: [UsulCategory] = [],
        surahNames: [Int: String]? = nil,
        onOpen: @escaping (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void = { _, _, _, _ in },
        onClose: (() -> Void)? = nil
    ) {
        self.categories = categories
        self.surahNames = surahNames
        self.onOpen = onOpen
        self.onClose = onClose
    }

    init(
        store: QiraatStore?,
        surahNames: [Int: String]? = nil,
        onOpen: @escaping (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void = { _, _, _, _ in },
        onClose: (() -> Void)? = nil
    ) {
        self.categories = UsulIndex.build(store: store)
        self.surahNames = surahNames
        self.onOpen = onOpen
        self.onClose = onClose
    }

    init(
        library: MushafLibrary,
        onOpen: @escaping (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void = { _, _, _, _ in },
        onClose: (() -> Void)? = nil
    ) {
        self.categories = UsulIndex.build(store: library.qiraat)
        self.surahNames = library.surahNames
        self.onOpen = onOpen
        self.onClose = onClose
    }

    var body: some View {
        NavigationStack {
            Group {
                if categories.isEmpty {
                    emptyStateView
                } else {
                    categoriesListView
                }
            }
            .background(Color(uiColor: .mushafPaper))
            .navigationTitle("أصول القراءات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") {
                        if let onClose {
                            onClose()
                        } else {
                            dismiss()
                        }
                    }
                    .accessibilityIdentifier("usul-index-close")
                }
            }
            .navigationDestination(for: UsulCategory.self) { category in
                UsulPlacesView(
                    category: category,
                    surahNames: surahNames,
                    onOpen: { page, surah, ayah, token in
                        onOpen(page, surah, ayah, token)
                        if let onClose {
                            onClose()
                        } else {
                            dismiss()
                        }
                    }
                )
            }
        }
        .accessibilityIdentifier("usul-index")
    }

    private var filteredCategories: [UsulCategory] {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        if query.isEmpty { return categories }
        return categories.filter {
            $0.categoryAr.contains(query) || $0.code.localizedCaseInsensitiveContains(query)
        }
    }

    private var categoriesListView: some View {
        List {
            ForEach(filteredCategories) { category in
                NavigationLink(value: category) {
                    categoryRow(category)
                }
                .accessibilityIdentifier("usul-category-\(category.code)")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .searchable(text: $searchText, prompt: "بحث في أبواب الأصول...")
    }

    private func categoryRow(_ category: UsulCategory) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(qiraatHex: category.color))
                .frame(width: 12, height: 12)

            Text(category.categoryAr)
                .font(.body.weight(.medium))
                .foregroundStyle(Color(uiColor: .mushafInk))

            Spacer()

            Text(ArabicDigits.string(category.count))
                .font(.callout.monospacedDigit())
                .foregroundStyle(Color(uiColor: .mushafBrown))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Capsule().fill(Color(qiraatHex: category.color).opacity(0.12)))
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(category.categoryAr)، \(ArabicDigits.string(category.count)) موضعًا")
        .accessibilityHint("اضغط لعرض مواضع هذا الباب")
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .scaledFont(size: 44)
                .foregroundStyle(.secondary)
            Text("لا توجد أصول متاحة")
                .font(.headline)
                .foregroundStyle(Color(uiColor: .mushafInk))
            Text("لم يتم العثور على بيانات أصول القراءات في هذا المصحف.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .accessibilityIdentifier("usul-index-empty")
    }
}

/// Lists all occurrences/places for a single أصول category.
struct UsulPlacesView: View {
    let category: UsulCategory
    let surahNames: [Int: String]?
    let onOpen: (_ page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> Void

    @State private var searchText: String = ""

    private var filteredPlaces: [UsulPlace] {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        if query.isEmpty { return category.places }
        return category.places.filter {
            $0.baseText.contains(query) ||
            String($0.page).contains(query) ||
            ArabicDigits.string($0.page).contains(query) ||
            (surahNames?[$0.surah]?.contains(query) ?? false)
        }
    }

    var body: some View {
        List {
            Section {
                ForEach(filteredPlaces) { place in
                    placeRow(place)
                }
            } header: {
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color(qiraatHex: category.color))
                        .frame(width: 8, height: 8)
                    Text(category.categoryAr)
                        .foregroundStyle(Color(uiColor: .mushafInk))
                    Spacer()
                    Text("\(ArabicDigits.string(category.count)) موضعًا")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .mushafPaper))
        .navigationTitle(category.categoryAr)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchText, prompt: "بحث في الكلمات أو الصفحات...")
    }

    private func placeRow(_ place: UsulPlace) -> some View {
        Button {
            onOpen(place.page, place.surah, place.ayah, place.startToken)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        if let name = surahNames?[place.surah] {
                            Text("سورة \(name)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color(uiColor: .mushafBrown))
                        } else {
                            Text("سورة \(ArabicDigits.string(place.surah))")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color(uiColor: .mushafBrown))
                        }
                        Text("— آية \(ArabicDigits.string(place.ayah))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Text(verbatim: place.baseText)
                        .font(Font(MushafLibrary.mushafFont(size: 22)))
                        .foregroundStyle(Color(uiColor: .mushafInk))
                        .lineLimit(2)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("صفحة \(ArabicDigits.string(place.page))")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("usul-place-\(place.page)-\(place.surah)-\(place.ayah)-\(place.startToken)")
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(surahAyahAccessibility(place: place))، \(place.baseText)، صفحة \(ArabicDigits.string(place.page))")
        .accessibilityHint("اضغط للانتقال إلى هذا الموضع في المصحف")
    }

    private func surahAyahAccessibility(place: UsulPlace) -> String {
        if let name = surahNames?[place.surah] {
            return "سورة \(name)، آية \(ArabicDigits.string(place.ayah))"
        }
        return "سورة \(ArabicDigits.string(place.surah))، آية \(ArabicDigits.string(place.ayah))"
    }
}
