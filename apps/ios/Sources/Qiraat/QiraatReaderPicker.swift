import MushafCore
import SwiftUI

/// Selection mode for QiraatReaderPicker: single authority or up to `max` authorities for compare.
enum SelectionMode: Equatable, Sendable {
    case single
    case multiple(max: Int)

}

/// Tashkeel-insensitive Arabic text normalization for search filtering.
enum ArabicTextNormalizer {
    /// The app's shared search normalisation (tashkeel, tatweel, alef/hamza forms, ta marbuta, alef maqsura).
    static func normalize(_ text: String) -> String {
        QuranSearchNormalizer.canonical(text).lowercased()
    }

    static func matches(target: String, query: String) -> Bool {
        let normQuery = normalize(query)
        guard !normQuery.isEmpty else { return true }
        let normTarget = normalize(target)
        return normTarget.contains(normQuery)
    }
}

struct QiraatReaderPicker: View {
    let catalog: QiraatCatalog
    let selectionMode: SelectionMode
    @Binding var selection: QiraatFilter
    let onPickMany: (([String]) -> Void)?

    @State private var searchText = ""
    @State private var selectedManyIDs: [String]
    @Environment(\.dismiss) private var dismiss

    init(
        catalog: QiraatCatalog,
        selection: Binding<QiraatFilter>,
        selectionMode: SelectionMode = .single,
        selectedIDs: [String]? = nil,
        onPickMany: (([String]) -> Void)? = nil
    ) {
        self.catalog = catalog
        self._selection = selection
        self.selectionMode = selectionMode
        self.onPickMany = onPickMany
        let initialIDs: [String]
        if let selectedIDs {
            initialIDs = selectedIDs
        } else {
            switch selection.wrappedValue {
            case .all: initialIDs = []
            case .reader(let id): initialIDs = [id]
            case .reading(let id): initialIDs = [id]
            }
        }
        self._selectedManyIDs = State(initialValue: initialIDs)
    }

    init(
        catalog: QiraatCatalog,
        selectionMode: SelectionMode = .multiple(max: 2),
        selectedIDs: [String] = [],
        onPickMany: (([String]) -> Void)? = nil
    ) {
        self.catalog = catalog
        self._selection = .constant(.all)
        self.selectionMode = selectionMode
        self.onPickMany = onPickMany
        self._selectedManyIDs = State(initialValue: selectedIDs)
    }

    private var isMultiSelect: Bool { selectionMode != .single }

    private var maxSelectable: Int {
        switch selectionMode {
        case .single: 1
        case .multiple(let max): max
        }
    }

    private var showAllRow: Bool {
        guard !isMultiSelect else { return false }
        guard !searchText.isEmpty else { return true }
        let normQuery = ArabicTextNormalizer.normalize(searchText)
        return ArabicTextNormalizer.normalize("كل القراء والرواة").contains(normQuery)
            || ArabicTextNormalizer.normalize("الكل").contains(normQuery)
    }

    private struct FilteredReader {
        let reader: QiraatCatalog.Reader
        let showReaderRow: Bool
        let narrators: [QiraatCatalog.Narrator]
    }

    private var filteredReaders: [FilteredReader] {
        let readers = catalog.readers.sorted { $0.sortOrder < $1.sortOrder }
        let query = ArabicTextNormalizer.normalize(searchText)
        if query.isEmpty {
            return readers.map { reader in
                FilteredReader(
                    reader: reader,
                    showReaderRow: true,
                    narrators: catalog.narrators(of: reader.id)
                )
            }
        }

        return readers.compactMap { reader in
            let readerMatches = ArabicTextNormalizer.matches(target: reader.nameAr, query: query)
                || ArabicTextNormalizer.matches(target: reader.nameArShort, query: query)
                || ArabicTextNormalizer.matches(target: reader.id, query: query)

            let allNarrators = catalog.narrators(of: reader.id)
            let matchingNarrators = allNarrators.filter { narrator in
                ArabicTextNormalizer.matches(target: narrator.nameAr, query: query)
                    || ArabicTextNormalizer.matches(target: narrator.id, query: query)
            }

            if readerMatches {
                return FilteredReader(
                    reader: reader,
                    showReaderRow: true,
                    narrators: allNarrators
                )
            } else if !matchingNarrators.isEmpty {
                return FilteredReader(
                    reader: reader,
                    showReaderRow: false,
                    narrators: matchingNarrators
                )
            } else {
                return nil
            }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if isMultiSelect {
                    multiSelectHeader
                }

                if showAllRow {
                    Button {
                        chooseSingle(.all)
                    } label: {
                        ReaderSelectionRow(
                            title: Text("كل القراء والرواة"),
                            colorHex: catalog.multiReaderColor,
                            isSelected: isSelected(.all),
                            isMultiSelect: isMultiSelect
                        )
                    }
                    .accessibilityIdentifier("qiraat-reader-all")
                }

                ForEach(filteredReaders, id: \.reader.id) { item in
                    let reader = item.reader
                    Section {
                        if item.showReaderRow {
                            Button {
                                if isMultiSelect {
                                    toggleMultiSelection(id: reader.id)
                                } else {
                                    chooseSingle(.reader(reader.id))
                                }
                            } label: {
                                ReaderSelectionRow(
                                    title: Text("روايتا الإمام \(reader.nameArShort)"),
                                    colorHex: reader.color,
                                    isSelected: isSelected(.reader(reader.id)),
                                    isMultiSelect: isMultiSelect
                                )
                            }
                            .accessibilityIdentifier("qiraat-reader-\(reader.id)")
                        }

                        ForEach(item.narrators) { narrator in
                            Button {
                                if isMultiSelect {
                                    toggleMultiSelection(id: narrator.id)
                                } else {
                                    chooseSingle(.reading(narrator.id))
                                }
                            } label: {
                                ReaderSelectionRow(
                                    title: Text(verbatim: narrator.nameAr),
                                    colorHex: narrator.color,
                                    isSelected: isSelected(.reading(narrator.id)),
                                    isMultiSelect: isMultiSelect
                                )
                            }
                            .accessibilityIdentifier("qiraat-narrator-\(narrator.id)")
                        }
                    } header: {
                        ReaderSectionHeader(reader: reader)
                    }
                }
            }
            .overlay {
                if filteredReaders.isEmpty && !showAllRow {
                    ContentUnavailableView.search(text: searchText)
                }
            }
            .searchable(text: $searchText, prompt: "بحث عن قارئ أو راوٍ")
            .navigationTitle("اختر القارئ أو الراوي")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isMultiSelect ? "إلغاء" : "إغلاق") { dismiss() }
                }
                if isMultiSelect {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("تم") {
                            onPickMany?(selectedManyIDs)
                            dismiss()
                        }
                        .disabled(selectedManyIDs.isEmpty)
                        .accessibilityIdentifier("qiraat-picker-done")
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var multiSelectHeader: some View {
        Section {
            HStack(spacing: 8) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.info)
                Text("اختر حتى \(maxSelectable) للمقارنة")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(selectedManyIDs.count)/\(maxSelectable)")
                    .font(.footnote.bold())
                    .foregroundStyle(selectedManyIDs.count == maxSelectable ? Color.progress : Color.secondary)
            }
            .padding(.vertical, 2)
        }
    }

    private func chooseSingle(_ filter: QiraatFilter) {
        selection = filter
        let ids: [String] = switch filter {
        case .all: ["all"]
        case .reader(let id): [id]
        case .reading(let id): [id]
        }
        onPickMany?(ids)
        dismiss()
    }

    private func toggleMultiSelection(id: String) {
        if let idx = selectedManyIDs.firstIndex(of: id) {
            selectedManyIDs.remove(at: idx)
        } else {
            if selectedManyIDs.count >= maxSelectable {
                selectedManyIDs.removeFirst()
            }
            selectedManyIDs.append(id)
        }
    }

    private func isSelected(_ filter: QiraatFilter) -> Bool {
        if isMultiSelect {
            switch filter {
            case .all:
                return false
            case .reader(let id):
                return selectedManyIDs.contains(id)
            case .reading(let id):
                return selectedManyIDs.contains(id)
            }
        } else {
            return selection == filter
        }
    }
}

private struct ReaderSectionHeader: View {
    let reader: QiraatCatalog.Reader

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color(qiraatHex: reader.color))
                .frame(width: 8, height: 8)
            Text(verbatim: reader.nameAr)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .accessibilityAddTraits(.isHeader)
    }
}

private struct ReaderSelectionRow: View {
    let title: Text
    let colorHex: String
    let isSelected: Bool
    let isMultiSelect: Bool

    var body: some View {
        let color = Color(qiraatHex: colorHex)
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                title
                    .font(.body)
                    .foregroundStyle(.primary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(isSelected ? 0.18 : 0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(color.opacity(isSelected ? 0.5 : 0.22), lineWidth: 1)
            )

            Spacer()

            if isMultiSelect {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? color : Color.secondary)
            } else if isSelected {
                Image(systemName: "checkmark")
                    .font(.body.weight(.bold))
                    .foregroundStyle(color)
            }
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
