import MushafCore
import SwiftUI
import UniformTypeIdentifiers

// MARK: - Magazine View Theme & Layout Helpers

enum MagazineCardSize {
    case hero
    case tall
    case compact
}

struct MutshabehatMagazineTheme {
    static let palette: [Color] = [
        Color(hex: "#0F5132"), // Emerald green
        Color(hex: "#1D4ED8"), // Royal blue
        Color(hex: "#6D28D9"), // Deep purple / amethyst
        Color(hex: "#C2410C"), // Desert terracotta
        Color(hex: "#BE123C"), // Imperial ruby
        Color(hex: "#B45309"), // Warm amber / ochre
        Color(hex: "#0F766E"), // Byzantine teal
        Color(hex: "#4D7C0F"), // Olive bronze
        Color(hex: "#3730A3"), // Persian indigo
        Color(hex: "#831843"), // Antique rosewood
        Color(hex: "#78350F"), // Walnut brown
        Color(hex: "#0284C7"), // Mediterranean azure
    ]

    static func color(for id: String, customColor: String) -> Color {
        let trimmed = customColor.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !trimmed.isEmpty && trimmed != "#55b94f" && trimmed != "55b94f" {
            return Color(uiColor: UIColor(Color(hex: customColor)).readable())
        }
        // `String.hashValue` is seeded per launch, so it gave a group a different colour each time
        // the app opened; FNV-1a over the UTF-8 bytes is stable.
        let hash = id.utf8.reduce(UInt64(14_695_981_039_346_656_037)) { ($0 ^ UInt64($1)) &* 1_099_511_628_211 }
        return Color(uiColor: UIColor(palette[Int(hash % UInt64(palette.count))]).readable())
    }
}

private enum MagazineBlock<T: Identifiable>: Identifiable {
    case hero(T)
    case pair(T, T)
    case single(T)

    var id: String {
        switch self {
        case .hero(let item): return "hero-\(item.id)"
        case .pair(let a, let b): return "pair-\(a.id)-\(b.id)"
        case .single(let item): return "single-\(item.id)"
        }
    }
}

private func buildMagazineBlocks<T: Identifiable>(from items: [T]) -> [MagazineBlock<T>] {
    var blocks: [MagazineBlock<T>] = []
    var i = 0
    var step = 0
    while i < items.count {
        if step % 3 == 0 || i == items.count - 1 {
            blocks.append(.hero(items[i]))
            i += 1
        } else {
            if i + 1 < items.count {
                blocks.append(.pair(items[i], items[i + 1]))
                i += 2
            } else {
                blocks.append(.single(items[i]))
                i += 1
            }
        }
        step += 1
    }
    return blocks
}

extension Array where Element: Hashable {
    func removingDuplicates() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

// MARK: - Magazine feed and card (shared by personal and automated groups)

/// Lays items out as hero / pair / single blocks; `card` draws one item at the size the block gives it.
private struct MagazineFeed<Item: Identifiable, Card: View>: View {
    let items: [Item]
    let card: (Item, MagazineCardSize) -> Card

    var body: some View {
        LazyVStack(spacing: 12) {
            ForEach(buildMagazineBlocks(from: items)) { block in
                switch block {
                case .hero(let item), .single(let item):
                    card(item, .hero)
                case .pair(let first, let second):
                    HStack(alignment: .top, spacing: 12) {
                        card(first, .tall).frame(maxWidth: .infinity, alignment: .topLeading)
                        card(second, .tall).frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                }
            }
        }
    }
}

/// The card both kinds of group share: surah tags and verse count, title, a diff preview of the first verse and the
/// "more locations" footer. `accessory` is the kind-specific badge or button at the end of the header row.
private struct MagazineCard<Accessory: View, Menu: View>: View {
    let surahs: [String]
    let verseCount: Int
    let title: String
    let firstVerseParts: [PersonalPart]?
    let size: MagazineCardSize
    let color: Color
    let onSelect: () -> Void
    @ViewBuilder let accessory: () -> Accessory
    @ViewBuilder let menu: () -> Menu

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    if !surahs.isEmpty {
                        Text(surahs.joined(separator: " • "))
                            .font((size == .compact ? Font.caption2 : Font.caption).weight(.bold))
                            .foregroundStyle(color)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 4)

                    Text("\(verseCount) مواضع")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                    accessory()
                }

                Text(verbatim: title)
                    .font((size == .hero ? Font.headline : Font.subheadline).weight(.bold))
                    .foregroundStyle(.primary)
                    .lineLimit(size == .compact ? 2 : 3)
                    .multilineTextAlignment(.leading)

                // Preview excerpt with auto-color diff tags
                if let firstVerseParts {
                    VStack(alignment: .leading, spacing: 4) {
                        ArabicDiffView(parts: firstVerseParts)
                            .lineLimit(size == .hero ? 3 : 2)
                    }
                }

                HStack {
                    if verseCount > 1 {
                        Text("+ \(verseCount - 1) مواضع أخرى")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.left")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(color.opacity(0.8))
                }
                .padding(.top, 2)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(color.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(color.opacity(0.30), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(action: onSelect) {
                Label("عرض كامل التفاصيل", systemImage: "arrow.up.left.and.arrow.down.right")
            }
            menu()
        }
    }
}

struct PersonalMagazineFeed: View {
    let groups: [PersonalGroup]
    let onToggleFavorite: (PersonalGroup) -> Void
    let onEdit: (PersonalGroup) -> Void
    let onSelect: (PersonalGroup) -> Void

    var body: some View {
        MagazineFeed(items: groups) { group, size in
            MagazineCard(
                surahs: group.verses.map(\.surah).removingDuplicates(),
                verseCount: group.verses.count,
                title: group.title,
                firstVerseParts: group.verses.first?.parts,
                size: size,
                color: MutshabehatMagazineTheme.color(for: group.id, customColor: group.color),
                onSelect: { onSelect(group) },
                accessory: {
                    Button { onToggleFavorite(group) } label: {
                        Image(systemName: group.favorite ? "star.fill" : "star")
                            .font(.footnote)
                            .foregroundColor(group.favorite ? .favorite : .secondary)
                    }
                    .buttonStyle(.plain)
                },
                menu: {
                    Button { onEdit(group) } label: { Label("تعديل المجموعة", systemImage: "pencil") }
                    Button { onToggleFavorite(group) } label: {
                        Label(group.favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة", systemImage: group.favorite ? "star.slash" : "star")
                    }
                })
        }
    }
}

struct AutomatedMagazineFeed: View {
    let groups: [AutomatedGroup]
    let onCopyToPersonal: (AutomatedGroup) -> Void
    let onSelect: (AutomatedGroup) -> Void

    var body: some View {
        MagazineFeed(items: groups) { group, size in
            MagazineCard(
                surahs: group.surahs,
                verseCount: group.verses.count,
                title: group.title,
                firstVerseParts: group.verses.first?.parts,
                size: size,
                color: MutshabehatMagazineTheme.color(for: String(group.id), customColor: group.color),
                onSelect: { onSelect(group) },
                accessory: {
                    if group.copied {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.progress)
                            .font(.footnote)
                    }
                },
                menu: {
                    Button { onCopyToPersonal(group) } label: {
                        Label("نسخ إلى مجموعاتي الخاصة", systemImage: "plus.square.on.square")
                    }
                })
        }
    }
}
