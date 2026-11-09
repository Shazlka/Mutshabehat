import MushafCore
import SwiftUI
import UIKit

/// iBooks-style page curl for a right-to-left book. Page 1 is on the right; the next page is
/// revealed by lifting the LEFT edge. In spread mode (iPad landscape) the odd page sits on the
/// right of the spine and its even partner on the left.
///
/// "before" is the page to the LEFT = the NEXT page in reading order. Verified 2026-09-30: with the
/// app running right-to-left (Arabic locale) UIKit's page curl keeps this geometry; forcing LTR on
/// the pager pins it, so a future UIKit that starts mirroring cannot silently reverse the turn.
struct MushafPager: UIViewControllerRepresentable {
    let library: MushafLibrary
    @Binding var page: Int
    let spread: Bool
    /// Curl or slide; a spread always curls (`PageTurnStyle.effective`).
    var turnStyle: PageTurnStyle = .curl
    let appearance: MushafAppearance
    /// How the surah banners look.
    var bannerStyle: SurahBannerStyle = .current
    let qiraat: QiraatDisplay
    let highlightedWordIDs: Set<String>
    let bookmarkedAyahs: (Int) -> Set<AyahKey>
    let isPageBookmarked: (Int) -> Bool
    /// Per-page ayah statuses for the optional memorization marker; returns [:] when the marker is off.
    var memorizationStatuses: (Int) -> [AyahKey: MemorizationStatus] = { _ in [:] }
    /// Changes whenever memorization changes, so the pager redraws the visible pages.
    var memorizationVersion = 0
    /// Changes whenever a bookmark is added or removed (`ReadingTracker.bookmarksVersion`), so the visible pages
    /// read their bookmarks again; unchanged, the pager does not touch the database on a redraw.
    var bookmarksVersion = 0
    let chromeVisible: Bool
    /// The page takes the full height (iPad landscape with the side rails).
    var fillsHeight = false
    let onTapCentre: () -> Void
    let onTapWord: (MushafPage, MushafWord) -> Void
    let onLongPressAyah: (MushafPage, AyahKey) -> Void

    /// Whether this pager slides (a `.scroll` pager) rather than curls. Reading it again later gives the same answer
    /// for the pager that was built, because a change of style or Reduce Motion rebuilds the pager (`.id` on the call
    /// site).
    var slides: Bool {
        turnStyle.effective(spread: spread, reduceMotion: UIAccessibility.isReduceMotionEnabled) == .slide
    }

    /// Everything that decides how a page looks and that `PageController.apply` takes. The bookmark and memorization
    /// closures are stood for by their versions, the colour scheme by the pager's own trait.
    struct Inputs: Equatable {
        let appearance: MushafAppearance
        let bannerStyle: SurahBannerStyle
        let qiraat: QiraatDisplay
        let highlightedWordIDs: Set<String>
        let chromeVisible: Bool
        let memorizationVersion: Int
        let bookmarksVersion: Int
        let interfaceStyle: UIUserInterfaceStyle
    }

    func inputs(interfaceStyle: UIUserInterfaceStyle) -> Inputs {
        Inputs(appearance: appearance, bannerStyle: bannerStyle, qiraat: qiraat,
               highlightedWordIDs: highlightedWordIDs, chromeVisible: chromeVisible,
               memorizationVersion: memorizationVersion, bookmarksVersion: bookmarksVersion,
               interfaceStyle: interfaceStyle)
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIPageViewController {
        let pager: UIPageViewController
        if slides {
            // `spineLocation` and `isDoubleSided` belong to the curl only; a slide has none.
            pager = UIPageViewController(transitionStyle: .scroll, navigationOrientation: .horizontal,
                                         options: [.interPageSpacing: 0])
        } else {
            let spine: UIPageViewController.SpineLocation = spread ? .mid : .max
            pager = UIPageViewController(transitionStyle: .pageCurl, navigationOrientation: .horizontal,
                                         options: [.spineLocation: NSNumber(value: spine.rawValue)])
            pager.isDoubleSided = spread
        }
        pager.view.semanticContentAttribute = .forceLeftToRight
        pager.view.backgroundColor = appearance.desk(for: pager.traitCollection, tint: qiraat.pageTint)
        pager.dataSource = context.coordinator
        pager.delegate = context.coordinator
        disableTapToTurn(in: pager)
        context.coordinator.pager = pager
        context.coordinator.show(page, in: pager, animated: false)
        return pager
    }

    func updateUIViewController(_ pager: UIPageViewController, context: Context) {
        context.coordinator.parent = self
        pager.view.backgroundColor = appearance.desk(for: pager.traitCollection, tint: qiraat.pageTint)
        disableTapToTurn(in: pager)
        let current = inputs(interfaceStyle: pager.traitCollection.userInterfaceStyle)
        // A redraw with nothing new (the reader's body runs for many reasons) neither re-reads the database for the
        // visible pages nor throws away the neighbours built ahead of the next turn.
        context.coordinator.inputsChanged(to: current)
        for controller in pager.viewControllers ?? [] {
            if let pc = controller as? PageController, pc.appliedInputs != current {
                let p = pc.page.number
                pc.apply(qiraat, highlightedWordIDs: highlightedWordIDs,
                         bookmarkedAyahs: bookmarkedAyahs(p),
                         isPageBookmarked: isPageBookmarked(p),
                         memorizationStatuses: memorizationStatuses(p),
                         appearance: appearance,
                         bannerStyle: bannerStyle,
                         chromeVisible: chromeVisible)
                pc.appliedInputs = current
            }
        }
        context.coordinator.show(page, in: pager, animated: true)
        context.coordinator.warmNeighbours(in: pager)
    }

    private func disableTapToTurn(in pager: UIPageViewController) {
        for recognizer in pager.gestureRecognizers where recognizer is UITapGestureRecognizer {
            recognizer.isEnabled = false
        }
    }

    @MainActor
    final class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
        var parent: MushafPager
        weak var pager: UIPageViewController?
        /// Fixed when the pager is built: a slide has the next page on the side the finger pulls from, which is the
        /// opposite of the curl's data source order.
        let slides: Bool
        init(_ parent: MushafPager) {
            self.parent = parent
            self.slides = parent.slides
        }

        /// VoiceOver's three-finger swipe: turn one page (or one spread) and announce where it landed.
        func accessibilityTurn(forward: Bool) -> Bool {
            guard let pager, let current = visiblePage(in: pager) else { return false }
            let step = parent.spread ? 2 : 1
            let target = forward ? current + step : current - step
            guard (1...mushafPageCount).contains(target) else { return false }
            parent.page = target
            show(target, in: pager, animated: true)
            UIAccessibility.post(notification: .pageScrolled, argument: "\(appLocalized("صفحة")) \(target)")
            return true
        }

        /// The inputs the controllers in `spare` and on screen were built for.
        private var currentInputs: Inputs?
        /// Neighbour pages built ahead (off the gesture path), each handed to the pager once.
        private var spare: [Int: PageController] = [:]

        /// New inputs make the spare neighbours stale: drop them.
        func inputsChanged(to inputs: Inputs) {
            guard inputs != currentInputs else { return }
            currentInputs = inputs
            spare.removeAll()
        }

        /// Builds the pages the next turn will ask for, on the next main-queue pass, so a swipe finds them ready.
        func warmNeighbours(in pager: UIPageViewController) {
            guard let visible = visiblePage(in: pager) else { return }
            let wanted: Set<Int> = parent.spread
                ? [visible - 2, visible - 1, visible + 2, visible + 3]
                : [visible - 1, visible + 1]
            let valid = wanted.filter { (1...mushafPageCount).contains($0) }
            spare = spare.filter { valid.contains($0.key) }
            let builtFor = currentInputs
            DispatchQueue.main.async { [weak self] in
                // The inputs changed while this waited: the next pass builds for the new ones.
                guard let self, self.currentInputs == builtFor else { return }
                for number in valid where self.spare[number] == nil {
                    self.spare[number] = self.makeController(for: number)
                }
            }
        }

        func controller(for number: Int) -> PageController? {
            if let ready = spare.removeValue(forKey: number), ready.parent == nil { return ready }
            return makeController(for: number)
        }

        private func makeController(for number: Int) -> PageController? {
            guard (1...mushafPageCount).contains(number), let page = parent.library.page(number) else { return nil }
            let controller = PageController(page: page, library: parent.library, isSpreadHalf: parent.spread,
                                  appearance: parent.appearance, qiraat: parent.qiraat,
                                  highlightedWordIDs: parent.highlightedWordIDs,
                                  bookmarkedAyahs: parent.bookmarkedAyahs(number),
                                  isPageBookmarked: parent.isPageBookmarked(number),
                                  memorizationStatuses: parent.memorizationStatuses(number),
                                  chromeVisible: parent.chromeVisible,
                                  fillsHeight: parent.fillsHeight,
                                  bannerStyle: parent.bannerStyle,
                                  onTapCentre: { [weak self] in self?.parent.onTapCentre() },
                                  onTapWord: { [weak self] page, word in self?.parent.onTapWord(page, word) },
                                  onLongPressAyah: { [weak self] page, ayah in self?.parent.onLongPressAyah(page, ayah) })
            controller.onAccessibilityTurn = { [weak self] forward in self?.accessibilityTurn(forward: forward) ?? false }
            controller.appliedInputs = parent.inputs(interfaceStyle: pager?.traitCollection.userInterfaceStyle ?? .unspecified)
            return controller
        }

        /// The page the pager shows: the single page, or the right-hand (odd) page of a spread.
        func visiblePage(in pager: UIPageViewController) -> Int? {
            pager.viewControllers?.compactMap { ($0 as? PageController)?.page.number }.min()
        }

        /// Shows `number` unless it is already on screen. Moving to a higher page number is reading
        /// forward, which in this LTR-forced geometry is UIKit's `.reverse`.
        func show(_ number: Int, in pager: UIPageViewController, animated: Bool) {
            let target = parent.spread ? Spread.rightPage(of: number) : number
            let current = visiblePage(in: pager)
            guard current != target else { return }
            let controllers: [UIViewController]
            if parent.spread {
                guard let left = controller(for: target + 1), let right = controller(for: target) else { return }
                controllers = [left, right]
            } else {
                guard let single = controller(for: target) else { return }
                controllers = [single]
            }
            let forward = target > (current ?? 0)
            // A jump across hundreds of pages would otherwise play a full 3D curl for someone who asked for less motion.
            let animate = animated && current != nil && !UIAccessibility.isReduceMotionEnabled
            let reading: UIPageViewController.NavigationDirection = slides ? .forward : .reverse
            let back: UIPageViewController.NavigationDirection = slides ? .reverse : .forward
            pager.setViewControllers(controllers, direction: forward ? reading : back, animated: animate)
            prewarm(around: target)
        }

        /// Decode the neighbours' fonts in the background so the next turn never waits on a woff2 decode.
        func prewarm(around page: Int) {
            let fonts = parent.library.fonts
            Task.detached(priority: .utility) { fonts.prewarm(pages: QCFFontStore.neighbourhood(of: page)) }
        }

        func pageViewController(_ pager: UIPageViewController, viewControllerBefore vc: UIViewController) -> UIViewController? {
            (vc as? PageController).flatMap { controller(for: $0.page.number + (slides ? -1 : 1)) }
        }

        func pageViewController(_ pager: UIPageViewController, viewControllerAfter vc: UIViewController) -> UIViewController? {
            (vc as? PageController).flatMap { controller(for: $0.page.number + (slides ? 1 : -1)) }
        }

        func pageViewController(_ pager: UIPageViewController, didFinishAnimating finished: Bool,
                                previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
            guard completed, let number = visiblePage(in: pager) else { return }
            parent.page = number
            prewarm(around: number)
            warmNeighbours(in: pager)
        }
    }
}
