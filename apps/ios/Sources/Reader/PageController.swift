import MushafCore
import UIKit

/// One page inside the pager: the desk colour, and the page fitted to the safe area at the print
/// aspect. In a spread, each half is one of these.
final class PageController: UIViewController {
    let page: MushafPage
    private let pageView: MushafPageView
    private let isSpreadHalf: Bool
    private let onTapCentre: () -> Void
    private let tap = UITapGestureRecognizer()

    init(page: MushafPage, library: MushafLibrary, isSpreadHalf: Bool, onTapCentre: @escaping () -> Void) {
        self.page = page
        self.pageView = MushafPageView(page: page, library: library)
        self.isSpreadHalf = isSpreadHalf
        self.onTapCentre = onTapCentre
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .mushafDesk
        view.addSubview(pageView)
        tap.addTarget(self, action: #selector(tapped(_:)))
        view.addGestureRecognizer(tap)
    }

    override func didMove(toParent parent: UIViewController?) {
        super.didMove(toParent: parent)
        // The pager turns a page on an edge tap; our centre tap only fires once that has failed.
        for recognizer in (parent as? UIPageViewController)?.gestureRecognizers ?? [] where recognizer is UITapGestureRecognizer {
            tap.require(toFail: recognizer)
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let area = view.bounds.inset(by: view.safeAreaInsets)
        // In a spread the odd page is the right-hand one, so its spine is on its left edge.
        let spine: PageLayoutConstants.SpineSide = !isSpreadHalf ? .none : page.isRightHandPage ? .left : .right
        pageView.frame = PageLayoutConstants.fittedPageRect(in: area, stretch: !isSpreadHalf, spine: spine).integral
    }

    @objc private func tapped(_ recognizer: UITapGestureRecognizer) {
        let x = recognizer.location(in: view).x / max(view.bounds.width, 1)
        // The outer 15% of the book belongs to page turning. A lone page has an outer edge on both
        // sides; a spread page only on the side away from the spine (the spine is the reader's).
        let leftIsOuter = !isSpreadHalf || !page.isRightHandPage
        let rightIsOuter = !isSpreadHalf || page.isRightHandPage
        if (!leftIsOuter || x > 0.15) && (!rightIsOuter || x < 0.85) { onTapCentre() }
    }
}
