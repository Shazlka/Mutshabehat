import MushafCore
import SwiftUI

struct QiraatReaderPicker: View {
    let catalog: QiraatCatalog
    @Binding var selection: QiraatFilter
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button {
                    choose(.all)
                } label: {
                    SelectionRow(title: "كل القراء والرواة", color: catalog.multiReaderColor, selected: selection == .all)
                }
                .accessibilityIdentifier("qiraat-reader-all")

                ForEach(catalog.readers.sorted { $0.sortOrder < $1.sortOrder }) { reader in
                    Section {
                        Button {
                            choose(.reader(reader.id))
                        } label: {
                            SelectionRow(title: "روايتا الإمام \(reader.nameArShort)", color: reader.color,
                                         selected: selection == .reader(reader.id))
                        }
                        .accessibilityIdentifier("qiraat-reader-\(reader.id)")

                        ForEach(catalog.narrators(of: reader.id)) { narrator in
                            Button {
                                choose(.reading(narrator.id))
                            } label: {
                                SelectionRow(title: narrator.nameAr, color: narrator.color,
                                             selected: selection == .reading(narrator.id))
                            }
                            .accessibilityIdentifier("qiraat-narrator-\(narrator.id)")
                        }
                    } header: {
                        Text("الإمام \(reader.nameAr)")
                            .foregroundStyle(Color(qiraatHex: reader.color))
                    }
                }
            }
            .navigationTitle("اختر القارئ أو الراوي")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }
                }
            }
        }
    }

    private func choose(_ value: QiraatFilter) {
        selection = value
        dismiss()
    }
}

private struct SelectionRow: View {
    let title: String
    let color: String
    let selected: Bool

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(qiraatHex: color))
                .frame(width: 14, height: 14)
            Text(title)
                .foregroundStyle(.primary)
            Spacer()
            if selected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color(qiraatHex: color))
            }
        }
        .contentShape(Rectangle())
    }
}
