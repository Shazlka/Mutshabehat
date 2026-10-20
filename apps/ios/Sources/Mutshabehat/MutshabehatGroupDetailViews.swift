import MushafCore
import SwiftUI
import UniformTypeIdentifiers

// MARK: - Full Page Detail Sheets

struct PersonalGroupDetailView: View {
    let group: PersonalGroup
    let library: MushafLibrary?
    let onEdit: (PersonalGroup) -> Void
    let onToggleFavorite: (PersonalGroup) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header card
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        let surahs = group.verses.map(\.surah).removingDuplicates()
                        if !surahs.isEmpty {
                            Text(surahs.joined(separator: " • "))
                                .font(.headline.bold())
                                .foregroundStyle(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color))
                        }
                        Spacer()
                        Text("\(group.verses.count) مواضع")
                            .font(.caption.bold())
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                        Button {
                            onToggleFavorite(group)
                        } label: {
                            Image(systemName: group.favorite ? "star.fill" : "star")
                                .foregroundColor(group.favorite ? .favorite : .secondary)
                                .font(.title3)
                        }
                    }

                    Text(verbatim: group.title)
                        .font(.title2.bold())
                        .foregroundStyle(.primary)

                    if let note = group.note, !note.trimmingCharacters(in: .whitespaces).isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "note.text")
                                .foregroundColor(.secondary)
                            Text(note)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(uiColor: .tertiarySystemFill).opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
                    }
                }
                .padding(18)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color).opacity(0.12))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color).opacity(0.35), lineWidth: 1.2)
                )

                // Verses Section
                VStack(alignment: .leading, spacing: 14) {
                    Text("المواضع والآيات المتشابهة")
                        .font(.headline.bold())
                        .foregroundColor(.primary)

                    ForEach(group.verses) { verse in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Label("\(verse.surah) - آية \(ArabicDigits.string(verse.ayah))", systemImage: "book.fill")
                                    .font(.subheadline.bold())
                                    .foregroundColor(MutshabehatMagazineTheme.color(for: group.id, customColor: group.color))

                                Spacer()

                                if let label = verse.label, !label.isEmpty {
                                    Text(label)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                                }
                            }

                            Divider()

                            ArabicDiffView(parts: verse.parts)
                                .padding(.vertical, 2)
                        }
                        .padding(16)
                        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .padding(16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(group.title.isEmpty ? "تفاصيل المتشابهة" : group.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    onEdit(group)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "pencil")
                        Text("تعديل")
                    }
                }
            }
        }
    }

}

struct AutomatedGroupDetailView: View {
    let group: AutomatedGroup
    let library: MushafLibrary?
    let onCopyToPersonal: (AutomatedGroup) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header card
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        if !group.surahs.isEmpty {
                            Text(group.surahs.joined(separator: " • "))
                                .font(.headline.bold())
                                .foregroundStyle(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color))
                        }
                        Spacer()
                        Text("\(group.verses.count) مواضع")
                            .font(.caption.bold())
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                        if group.copied {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.progress)
                        }
                    }

                    Text(verbatim: group.title)
                        .font(.title2.bold())
                        .foregroundStyle(.primary)

                    HStack {
                        Label("قاعدة آلية رسمية", systemImage: "sparkles")
                            .font(.caption.bold())
                            .foregroundColor(.insight)
                        Spacer()
                        Button {
                            onCopyToPersonal(group)
                        } label: {
                            Label(group.copied ? "تم النسخ" : "نسخ للمجموعات الخاصة", systemImage: "plus.square.on.square")
                                .font(.caption.bold())
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.insight)
                    }
                }
                .padding(18)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color).opacity(0.12))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color).opacity(0.35), lineWidth: 1.2)
                )

                // Verses Section
                VStack(alignment: .leading, spacing: 14) {
                    Text("المواضع والآيات المتشابهة")
                        .font(.headline.bold())
                        .foregroundColor(.primary)

                    ForEach(Array(group.verses.enumerated()), id: \.offset) { _, verse in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Label("\(verse.surah) - آية \(ArabicDigits.string(verse.ayah))", systemImage: "book.fill")
                                    .font(.subheadline.bold())
                                    .foregroundColor(MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color))

                                Spacer()

                                if let label = verse.label, !label.isEmpty {
                                    Text(label)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                                }
                            }

                            Divider()

                            ArabicDiffView(parts: verse.parts)
                                .padding(.vertical, 2)
                        }
                        .padding(16)
                        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .padding(16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(group.title.isEmpty ? "تفاصيل المتشابهة الآلية" : group.title)
        .navigationBarTitleDisplayMode(.inline)
    }

}
