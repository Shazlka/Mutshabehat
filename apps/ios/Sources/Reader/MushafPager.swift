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
    let onTapCentre: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIPageViewController {
        let spine: UIPageViewController.SpineLocation = spread ? .mid : .max
        let pager = UIPageViewController(transitionStyle: .pageCurl, navigationOrientation: .horizontal,
                                         options: [.spineLocation: NSNumber(value: spine.rawValue)])
        pager.view.semanticContentAttribute = .forceLeftToRight
        pager.view.backgroundColor = .mushafDesk
        pager.isDoubleSided = spread
        pager.dataSource = context.coordinator
        pager.delegate = context.coordinator
        context.coordinator.show(page, in: pager, animated: false)
        return pager
    }

    func updateUIViewController(_ pager: UIPageViewController, context: Context) {
        context.coordinator.parent = self
        context.coordinator.show(page, in: pager, animated: true)
    }

    @MainActor
    final class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
        var parent: MushafPager
        init(_ parent: MushafPager) { self.parent = parent }

        func controller(for number: Int) -> PageController? {
            guard (1...mushafPageCount).contains(number), let page = parent.library.page(number) else { return nil }
            return PageController(page: page, library: parent.library, isSpreadHalf: parent.spread) { [weak self] in
                self?.parent.onTapCentre()
            }
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
            pager.setViewControllers(controllers, direction: forward ? .reverse : .forward, animated: animated && current != nil)
            prewarm(around: target)
        }

        /// Decode the neighbours' fonts in the background so the next turn never waits on a woff2 decode.
        func prewarm(around page: Int) {
            let fonts = parent.library.fonts
            Task.detached(priority: .utility) { fonts.prewarm(pages: QCFFontStore.neighbourhood(of: page)) }
        }

        func pageViewController(_ pager: UIPageViewController, viewControllerBefore vc: UIViewController) -> UIViewController? {
            (vc as? PageController).flatMap { controller(for: $0.page.number + 1) }
        }

        func pageViewController(_ pager: UIPageViewController, viewControllerAfter vc: UIViewController) -> UIViewController? {
            (vc as? PageController).flatMap { controller(for: $0.page.number - 1) }
        }

        func pageViewController(_ pager: UIPageViewController, didFinishAnimating finished: Bool,
                                previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
            guard completed, let number = visiblePage(in: pager) else { return }
            parent.page = number
            prewarm(around: number)
        }
    }
}
