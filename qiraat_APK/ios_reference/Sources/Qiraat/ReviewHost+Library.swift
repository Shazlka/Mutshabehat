#if DEBUG
import MushafCore
import ReviewEditor
import UIKit

extension ReviewHost {
    /// The review editor's only view of the app: this library's pages and fonts, the web app, and the live-page refresh.
    @MainActor
    static func make(library: MushafLibrary) -> ReviewHost {
        ReviewHost(
            surahs: library.surahs, surahAyahCounts: library.surahAyahCounts, surahNames: library.surahNames,
            fonts: library.fonts,
            page: { library.page($0) },
            mushafFont: { MushafLibrary.mushafFont(size: $0) },
            palette: ReviewPalette(paper: .mushafPaper, ink: .mushafInk, gold: .mushafGold, brown: .mushafBrown),
            baseURL: AppEndpoints.webApp,
            deviceId: DeviceID.current(key: "qiraat-review-device-id"),
            refreshLivePage: { page in
                Task { @MainActor in _ = await QiraatLiveSync.shared.refresh(page: page, store: library.qiraat, force: true) }
            })
    }
}
#endif
