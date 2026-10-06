import Foundation

public struct AyahRun: Equatable, Sendable {
    public let status: MemorizationStatus
    public let from: Int
    public let to: Int

    public init(status: MemorizationStatus, from: Int, to: Int) {
        self.status = status
        self.from = from
        self.to = to
    }
}

extension MemorizationStatisticsService {
    public static func runs(
        forSurah surah: Int,
        records: [AyahKey: AyahMemorizationRecord],
        index: QuranIndex
    ) -> [AyahRun] {
        let ayat = index.ayat(ofSurah: surah)
        guard !ayat.isEmpty else { return [] }

        var runs: [AyahRun] = []
        var currentStatus: MemorizationStatus?
        var currentFrom: Int = 1
        var currentTo: Int = 1

        for key in ayat {
            let status = records[key]?.status ?? .notMemorized
            if let active = currentStatus {
                if active == status {
                    currentTo = key.ayah
                } else {
                    runs.append(AyahRun(status: active, from: currentFrom, to: currentTo))
                    currentStatus = status
                    currentFrom = key.ayah
                    currentTo = key.ayah
                }
            } else {
                currentStatus = status
                currentFrom = key.ayah
                currentTo = key.ayah
            }
        }

        if let active = currentStatus {
            runs.append(AyahRun(status: active, from: currentFrom, to: currentTo))
        }

        return runs
    }
}
