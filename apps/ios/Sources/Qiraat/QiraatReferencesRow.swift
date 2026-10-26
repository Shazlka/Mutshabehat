import MushafCore
import SwiftUI

/// The scholarly references (الشاطبية، الدرة، طيبة النشر) the Qiraat card can show per variant; set where the card
/// is built so the sheet and the iPad side bar both see it.
struct QiraatReferencesKey: EnvironmentKey {
    static let defaultValue = QiraatReferenceStore.empty
}

extension EnvironmentValues {
    var qiraatReferences: QiraatReferenceStore {
        get { self[QiraatReferencesKey.self] }
        set { self[QiraatReferencesKey.self] = newValue }
    }
}

/// «المصادر» under a variant card: one chip per work that documents the variant (with its verse and status), and,
/// opened inline, each verse as the source prints it. Nothing is drawn when the app has no references file at all.
/// The verse is set in a plain Arabic face: it is a quotation from a matn, never Quran text, so it never uses the
/// Mushaf fonts. A reference whose readers do not match the word's data is shown with a warning, never dropped.
struct QiraatReferencesRow: View {
    let variant: QiraatVariant
    let catalog: QiraatCatalog

    @Environment(\.qiraatReferences) private var store
    @State private var expanded = false

    var body: some View {
        if !store.isEmpty {
            let references = store.references(for: variant)
            VStack(alignment: .leading, spacing: 6) {
                if references.isEmpty {
                    Text("المصادر: لم يُوثَّق بعد")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("qiraat-references-none")
                } else {
                    header
                    chips(references)
                    if expanded {
                        // Offsets are the ids: two references can share a work and a verse.
                        ForEach(Array(references.enumerated()), id: \.offset) { _, reference in
                            referenceBlock(reference)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var header: some View {
        Button { expanded.toggle() } label: {
            HStack(spacing: 6) {
                Text("المصادر").font(.caption.bold())
                Image(systemName: expanded ? "chevron.up" : "chevron.down").font(.caption2).accessibilityHidden(true)
                Spacer(minLength: 0)
            }
            .foregroundStyle(Color(uiColor: .mushafBrown))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isHeader)
        .accessibilityValue(expanded ? Text("مفتوح") : Text("مغلق"))
        .accessibilityIdentifier("qiraat-references-row")
    }

    /// One chip per work, in the order الشاطبية، الدرة، طيبة النشر: its name, the verse when it cites one, and
    /// the least-checked status among its references (colour is never the only cue: the status is written).
    private func chips(_ references: [QiraatReference]) -> some View {
        FlowLayout(spacing: 6) {
            ForEach(QiraatMatn.allCases.filter { work in references.contains { $0.work == work } }, id: \.self) { work in
                let own = references.filter { $0.work == work }
                let verses = own.compactMap(\.verse)
                let status = Self.weakestStatus(own)
                HStack(spacing: 4) {
                    workName(work).font(.caption.bold())
                    if verses.count == 1, let verse = verses.first { Text(verbatim: "\(verse)").font(.caption.bold()) }
                    Text(verbatim: "·").font(.caption).accessibilityHidden(true)
                    statusLabel(status).font(.caption2)
                }
                .foregroundStyle(Color(uiColor: .mushafInk))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Capsule().fill(Self.tint(status)))
                .overlay(Capsule().stroke(.qiraatCardStroke))
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("qiraat-reference-chip-\(work.rawValue)")
            }
        }
    }

    private func referenceBlock(_ reference: QiraatReference) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            FlowLayout(spacing: 6) {
                fromWork(reference.work).font(.caption.bold())
                if let verse = reference.verse { Text("البيت \(verse)").font(.caption) }
                if let page = reference.printedPage?.trimmingCharacters(in: .whitespaces), !page.isEmpty {
                    Text("ص \(page)").font(.caption)
                }
                statusLabel(reference.status).font(.caption2)
            }
            .foregroundStyle(Color(uiColor: .mushafBrown))
            VStack(alignment: .leading, spacing: 2) {
                ForEach(Array(reference.lines.enumerated()), id: \.offset) { _, line in
                    Text(verbatim: line)
                        .font(.system(.body, design: .serif))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("qiraat-reference-lines")
            if let symbol = reference.symbolText?.trimmingCharacters(in: .whitespaces), !symbol.isEmpty {
                Text("الرمز: \(symbol)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            let pills = rollupAuthorityPills(reference.readingIds, catalog: catalog)
            if !pills.isEmpty {
                Text(reference.side == .variant ? "القرّاء المذكورون (بهذه القراءة)" : "القرّاء المذكورون (بالقراءة الأخرى)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                QiraatPills(pills: pills)
            }
            if case .mismatch = store.consistency(reference, variant: variant, catalog: catalog) {
                Label {
                    Text("لا يطابق قراءات هذه الكلمة، يحتاج مراجعة")
                } icon: {
                    Image(systemName: "exclamationmark.triangle")
                }
                .font(.caption.bold())
                .foregroundStyle(Color(uiColor: .mushafBrown))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("qiraat-reference-mismatch")
            }
            if let note = reference.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                Text(verbatim: note)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let link = reference.sourceUrl.flatMap(URL.init(string:)), let scheme = link.scheme?.lowercased(),
               scheme == "https" || scheme == "http" {
                Link(destination: link) {
                    Text("افتح في الشاملة").font(.caption.bold()).frame(minHeight: 44)
                }
                .accessibilityIdentifier("qiraat-reference-source")
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 8).stroke(.qiraatCardStroke))
    }

    // MARK: - Labels (localized literals, so the English UI translates them)

    private func workName(_ work: QiraatMatn) -> Text {
        switch work {
        case .shatibiyyah: Text("الشاطبية")
        case .durrah: Text("الدرة")
        case .tayyibah: Text("طيبة النشر")
        }
    }

    private func fromWork(_ work: QiraatMatn) -> Text {
        switch work {
        case .shatibiyyah: Text("من متن الشاطبية")
        case .durrah: Text("من متن الدرة")
        case .tayyibah: Text("من متن طيبة النشر")
        }
    }

    private func statusLabel(_ status: QiraatReference.Status) -> Text {
        switch status {
        case .extracted: Text("مستخرج")
        case .reviewed: Text("مراجَع")
        case .verified: Text("موثّق")
        }
    }

    /// A work's chip shows the least-checked of its references, so one unchecked verse is never hidden behind another.
    static func weakestStatus(_ references: [QiraatReference]) -> QiraatReference.Status {
        if references.contains(where: { $0.status == .extracted }) { return .extracted }
        if references.contains(where: { $0.status == .reviewed }) { return .reviewed }
        return references.isEmpty ? .extracted : .verified
    }

    private static func tint(_ status: QiraatReference.Status) -> Color {
        switch status {
        case .extracted: .clear
        case .reviewed: Color(uiColor: .mushafBrown).opacity(0.08)
        case .verified: Color(uiColor: .mushafBrown).opacity(0.18)
        }
    }
}
