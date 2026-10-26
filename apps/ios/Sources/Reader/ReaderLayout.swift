import CoreGraphics
import MushafCore

/// What an iPad in landscape shows: two facing pages for reading, or one page with the Qiraat side bar for learning.
enum LandscapeView: String, CaseIterable {
    case reading
    case learning

    static let storageKey = "mushaf:landscapeView:v1"

    /// Reading unless «تعلّم» was chosen.
    init(stored: String) { self = LandscapeView(rawValue: stored) ?? .reading }
}

/// The reader's layout for a screen of this size.
enum ReaderLayout: Equatable {
    case single
    case spread
    /// One page, and the Qiraat side bar beside it.
    case learning

    /// A spread wherever the web shows one (`Spread.isSpread`, iPad landscape); there «تعلّم» swaps it for one page
    /// and the side bar.
    static func resolve(width: Double, height: Double, landscapeView: LandscapeView) -> ReaderLayout {
        guard Spread.isSpread(width: width, height: height) else { return .single }
        return landscapeView == .learning ? .learning : .spread
    }

    /// The information rail (left) and the action rail (right) of iPad landscape.
    static let railWidth: CGFloat = 80

    /// 400 pt, wide enough for a variant card, and never more than a third of the screen.
    static func sideBarWidth(screenWidth: CGFloat) -> CGFloat { min(400, screenWidth / 3) }
}
