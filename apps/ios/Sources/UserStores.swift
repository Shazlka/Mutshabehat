import Foundation

/// The user-data stores the sync and backup services work on. `live` is the only place that names the app's
/// global instances for them; tests (and anything else) pass their own, so a service never has to reach for a
/// global. The reading tracker and the notes store are given as closures because they live on the main actor and
/// are created lazily.
struct UserStores {
    var mutshabehat: MutshabehatDatabase
    var reading: QuranReadingDatabase
    var tracker: @MainActor () -> ReadingTracker
    var qiraatNotes: @MainActor () -> QiraatNotesStore

    static var live: UserStores {
        UserStores(mutshabehat: .shared, reading: .shared, tracker: { .shared }, qiraatNotes: { .shared })
    }
}

extension ReadingTracker {
    /// The app's tracker: the shared reading database, pushed to iCloud through the sync service. Built here, at the
    /// composition root, so the Reading feature itself never names the Sync feature.
    static let shared = ReadingTracker(database: .shared, sync: ICloudDatabaseSyncService.shared)
}
