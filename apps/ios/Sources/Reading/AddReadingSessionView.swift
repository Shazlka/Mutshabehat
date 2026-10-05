import MushafCore
import SwiftUI

struct AddReadingSessionView: View {
    let library: MushafLibrary
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var tracker = ReadingTracker.shared

    enum RangeMode: String, CaseIterable, Identifiable {
        case bySurah = "bySurah"
        case byAyah = "byAyah"
        case byPage = "byPage"

        var title: String {
            switch self {
            case .bySurah: "سورة كاملة"
            case .byAyah: "حسب الآيات"
            case .byPage: "حسب الصفحات"
            }
        }

        var id: String { rawValue }
    }

    @State private var mode: RangeMode = .bySurah

    // Surah mode state
    @State private var selectedSurahNumber: Int = 1

    // Ayah mode state
    @State private var fromSurahNumber: Int = 1
    @State private var fromAyahNumber: Int = 1
    @State private var toSurahNumber: Int = 1
    @State private var toAyahNumber: Int = 7

    // Page mode state
    @State private var fromPage: Int = 1
    @State private var toPage: Int = 1

    // Metadata
    @State private var sessionDate: Date = Date()
    @State private var durationMinutes: Int = 15
    @State private var isFromMemory: Bool = false

    private let quickDurations = [5, 10, 15, 20, 30, 45, 60]

    private var selectedSurah: Surah? {
        library.surahs.first { $0.number == selectedSurahNumber }
    }

    private var selectedSurahMaxAyahs: Int {
        library.surahAyahCounts[selectedSurahNumber] ?? 7
    }

    private var fromSurahMaxAyahs: Int {
        library.surahAyahCounts[fromSurahNumber] ?? 7
    }

    private var toSurahMaxAyahs: Int {
        library.surahAyahCounts[toSurahNumber] ?? 7
    }

    private var estimatedAyahCount: Int {
        switch mode {
        case .bySurah:
            return selectedSurahMaxAyahs
        case .byAyah:
            if fromSurahNumber == toSurahNumber {
                return max(1, toAyahNumber - fromAyahNumber + 1)
            } else if fromSurahNumber < toSurahNumber {
                var total = (library.surahAyahCounts[fromSurahNumber] ?? 0) - fromAyahNumber + 1
                for s in (fromSurahNumber + 1)..<toSurahNumber {
                    total += library.surahAyahCounts[s] ?? 0
                }
                total += toAyahNumber
                return max(1, total)
            } else {
                return 1
            }
        case .byPage:
            let pages = max(1, toPage - fromPage + 1)
            return pages * 15 // Average approximation
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                // MARK: - 1. Reading Range Section
                Section {
                    Picker("نمط التحديد", selection: $mode) {
                        ForEach(RangeMode.allCases) { m in
                            Text(m.title).tag(m)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

                    if mode == .bySurah {
                        // Full Surah Mode
                        VStack(alignment: .leading, spacing: 10) {
                            Text("اختر السورة لتسجيلها كاملة:")
                                .font(.caption.bold())
                                .foregroundColor(.secondary)

                            Picker("السورة", selection: $selectedSurahNumber) {
                                ForEach(library.surahs) { surah in
                                    Text("\(surah.number). \(surah.name)").tag(surah.number)
                                }
                            }
                            .pickerStyle(.menu)
                            .tint(.primary)

                            if let surah = selectedSurah {
                                let meta = AdvancedQuranSearchData.surahMetadata[surah.number]
                                HStack(spacing: 8) {
                                    Label("\(surah.ayahCount) آية", systemImage: "text.alignleft")
                                        .font(.caption.bold())
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color.green.opacity(0.12), in: Capsule())
                                        .foregroundColor(.green)

                                    Label("ص \(surah.firstPage)", systemImage: "book.pages")
                                        .font(.caption)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color(uiColor: .tertiarySystemFill), in: Capsule())

                                    if let type = meta?.type {
                                        Text(type == .makkiyah ? "مَكِّيَّة" : "مَدَنِيَّة")
                                            .font(.caption.bold())
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                                    }
                                }
                                .padding(.top, 2)
                            }
                        }
                        .padding(.vertical, 4)

                    } else if mode == .byAyah {
                        // From Ayah
                        VStack(alignment: .leading, spacing: 6) {
                            Text("بدء من:")
                                .font(.caption.bold())
                                .foregroundColor(.secondary)
                            HStack {
                                Picker("السورة", selection: $fromSurahNumber) {
                                    ForEach(library.surahs) { surah in
                                        Text("\(surah.number). \(surah.name)").tag(surah.number)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(.primary)
                                .onChange(of: fromSurahNumber) { _, _ in
                                    fromAyahNumber = 1
                                    if toSurahNumber < fromSurahNumber {
                                        toSurahNumber = fromSurahNumber
                                        toAyahNumber = fromSurahMaxAyahs
                                    }
                                }

                                Spacer()

                                Stepper("آية: \(fromAyahNumber)", value: $fromAyahNumber, in: 1...fromSurahMaxAyahs)
                                    .fixedSize()
                            }
                        }
                        .padding(.vertical, 4)

                        // To Ayah
                        VStack(alignment: .leading, spacing: 6) {
                            Text("انتهاء عند:")
                                .font(.caption.bold())
                                .foregroundColor(.secondary)
                            HStack {
                                Picker("السورة", selection: $toSurahNumber) {
                                    ForEach(library.surahs.filter { $0.number >= fromSurahNumber }) { surah in
                                        Text("\(surah.number). \(surah.name)").tag(surah.number)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(.primary)
                                .onChange(of: toSurahNumber) { _, _ in
                                    toAyahNumber = min(toAyahNumber, toSurahMaxAyahs)
                                }

                                Spacer()

                                Stepper("آية: \(toAyahNumber)", value: $toAyahNumber, in: 1...toSurahMaxAyahs)
                                    .fixedSize()
                            }
                        }
                        .padding(.vertical, 4)

                        // Quick full surah selector button
                        Button {
                            fromAyahNumber = 1
                            toSurahNumber = fromSurahNumber
                            toAyahNumber = fromSurahMaxAyahs
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "checkmark.circle.fill")
                                Text("تحديد كامل السورة (\(fromSurahMaxAyahs) آية)")
                            }
                            .font(.caption.bold())
                            .foregroundColor(.green)
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 2)

                    } else {
                        // Page Mode
                        HStack {
                            Text("من صفحة")
                            Spacer()
                            Stepper("\(fromPage)", value: $fromPage, in: 1...604)
                                .fixedSize()
                                .onChange(of: fromPage) { _, newP in
                                    if toPage < newP { toPage = newP }
                                }
                        }

                        HStack {
                            Text("إلى صفحة")
                            Spacer()
                            Stepper("\(toPage)", value: $toPage, in: fromPage...604)
                                .fixedSize()
                        }
                    }

                    // Range Summary Badge
                    HStack {
                        Image(systemName: "book.pages.fill")
                            .foregroundColor(.green)
                        Text(mode == .byPage ? "المجموع: \(toPage - fromPage + 1) صفحة" : "المجموع: \(estimatedAyahCount) آية")
                            .font(.subheadline.bold())
                            .foregroundColor(.primary)
                        Spacer()
                    }
                    .padding(.vertical, 2)
                } header: {
                    Text("الموضع المقروء")
                }

                // MARK: - 2. Time & Duration Section
                Section {
                    DatePicker(
                        "تاريخ ووقت القراءة",
                        selection: $sessionDate,
                        displayedComponents: [.date, .hourAndMinute]
                    )

                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("مدة الجلسة")
                            Spacer()
                            Text("\(durationMinutes) دقيقة")
                                .font(.subheadline.bold())
                                .foregroundColor(.green)
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(quickDurations, id: \.self) { mins in
                                    Button {
                                        durationMinutes = mins
                                    } label: {
                                        Text("\(mins) د")
                                            .font(.caption.bold())
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 7)
                                            .background(durationMinutes == mins ? Color.green : Color(uiColor: .tertiarySystemFill))
                                            .foregroundColor(durationMinutes == mins ? .white : .primary)
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                } header: {
                    Text("التوقيت والمدة")
                }

                // MARK: - 3. Additional Options Section
                Section {
                    Toggle(isOn: $isFromMemory) {
                        HStack(spacing: 12) {
                            Image(systemName: "brain.head.profile")
                                .foregroundColor(.purple)
                                .font(.system(size: 20))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("تلوتُ عن ظهر قلب (من الذاكرة)")
                                    .font(.system(size: 15, weight: .medium))
                                Text("حفظ أو مراجعة بدون الاستعانة بالمصحف")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .tint(.green)
                } header: {
                    Text("طريقة التلاوة")
                }

                // MARK: - 4. Action Button
                Section {
                    Button(action: saveSession) {
                        HStack {
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                            Text("تأكيد وتسجيل الجلسة")
                                .font(.headline)
                            Spacer()
                        }
                        .foregroundColor(.white)
                        .padding(.vertical, 6)
                    }
                    .listRowBackground(Color.green)
                }
            }
            .navigationTitle("أضف جلسة قراءة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("حفظ") {
                        saveSession()
                    }
                    .bold()
                    .tint(.green)
                }
            }
        }
    }

    private func saveSession() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()

        switch mode {
        case .bySurah:
            tracker.recordManualSession(
                fromSurah: selectedSurahNumber,
                fromAyah: 1,
                toSurah: selectedSurahNumber,
                toAyah: selectedSurahMaxAyahs,
                sessionDate: sessionDate,
                durationMinutes: durationMinutes,
                fromMemory: isFromMemory,
                library: library
            )
        case .byAyah:
            tracker.recordManualSession(
                fromSurah: fromSurahNumber,
                fromAyah: fromAyahNumber,
                toSurah: toSurahNumber,
                toAyah: toAyahNumber,
                sessionDate: sessionDate,
                durationMinutes: durationMinutes,
                fromMemory: isFromMemory,
                library: library
            )
        case .byPage:
            tracker.recordManualPageRangeSession(
                fromPage: fromPage,
                toPage: toPage,
                sessionDate: sessionDate,
                durationMinutes: durationMinutes,
                fromMemory: isFromMemory,
                library: library
            )
        }

        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onSave()
        dismiss()
    }
}
