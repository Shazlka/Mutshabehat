#if DEBUG
import MushafCore
import UIKit

public struct ReviewPalette {
    public var paper: UIColor, ink: UIColor, gold: UIColor, brown: UIColor
    public init(paper: UIColor, ink: UIColor, gold: UIColor, brown: UIColor) {
        self.paper = paper; self.ink = ink; self.gold = gold; self.brown = brown
    }
}

/// What the review editor needs from the app that hosts it: the Mushaf pages and fonts to draw, the web app to talk
/// to, and a way to tell the reader a page changed. The app builds one from its library; the editor has no other
/// link to the app.
@MainActor
public struct ReviewHost {
    public var surahs: [Surah]
    public var surahAyahCounts: [Int: Int]
    public var surahNames: [Int: String]
    public var fonts: QCFFontStore
    public var page: (Int) -> MushafPage?
    public var mushafFont: (CGFloat) -> UIFont
    /// The page colours (paper, ink, gold, brown), which follow the light/dark appearance.
    public var palette: ReviewPalette
    public var baseURL: URL
    public var deviceId: String
    /// Called with a page number after the review API changed it, so the reader refetches that page.
    public var refreshLivePage: (Int) -> Void

    public init(surahs: [Surah], surahAyahCounts: [Int: Int], surahNames: [Int: String], fonts: QCFFontStore,
                page: @escaping (Int) -> MushafPage?, mushafFont: @escaping (CGFloat) -> UIFont, palette: ReviewPalette,
                baseURL: URL, deviceId: String, refreshLivePage: @escaping (Int) -> Void) {
        self.surahs = surahs; self.surahAyahCounts = surahAyahCounts; self.surahNames = surahNames
        self.fonts = fonts; self.page = page; self.mushafFont = mushafFont; self.palette = palette
        self.baseURL = baseURL; self.deviceId = deviceId; self.refreshLivePage = refreshLivePage
    }
}
#endif
