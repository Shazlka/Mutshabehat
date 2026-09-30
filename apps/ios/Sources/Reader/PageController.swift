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
        pageView.frame = PageLayoutConstants.fittedPageRect(in: area, stretch: !isSpreadHalf).integral
    }

    @objc private func tapped(_ recognizer: UITapGestureRecognizer) {
        let x = recognizer.location(in: view).x / max(view.bounds.width, 1)
        // Outer 15% on each side belongs to page turning.
        if x > 0.15 && x < 0.85 { onTapCentre() }
    }
}
