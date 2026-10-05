import MushafCore
import UIKit

/// One page inside the pager: the desk colour, and the page fitted to the safe area at the print
/// aspect. In a spread, each half is one of these.
final class PageController: UIViewController, UIGestureRecognizerDelegate {
    let page: MushafPage
    private let pageView: MushafPageView
    private var appearance: MushafAppearance
    private let surahLabel = UILabel()
    private let sectionLabel = UILabel()
    private let pageNumberLabel = UILabel()
    private let isSpreadHalf: Bool
    private let onTapCentre: () -> Void
    private let onTapWord: (MushafPage, MushafWord) -> Void
    private let onLongPressAyah: ((MushafPage, AyahKey) -> Void)?
    private let tap = UITapGestureRecognizer()
    /// Begins only on a Qiraat-marked word; while it can still succeed, the chrome tap waits for it.
    private let wordTap = UITapGestureRecognizer()
    private let longPress = UILongPressGestureRecognizer()
    private(set) var chromeVisible: Bool = false

    init(page: MushafPage, library: MushafLibrary, isSpreadHalf: Bool, appearance: MushafAppearance,
         qiraat: QiraatDisplay,
         highlightedWordIDs: Set<String>,
         bookmarkedAyahs: Set<AyahKey> = [],
         isPageBookmarked: Bool = false,
         chromeVisible: Bool = false,
         onTapCentre: @escaping () -> Void,
         onTapWord: @escaping (MushafPage, MushafWord) -> Void,
         onLongPressAyah: ((MushafPage, AyahKey) -> Void)? = nil) {
        self.page = page
        self.pageView = MushafPageView(page: page, library: library, appearance: appearance)
        self.appearance = appearance
        self.isSpreadHalf = isSpreadHalf
        let spine: PageLayoutConstants.SpineSide = !isSpreadHalf ? .none : page.isRightHandPage ? .left : .right
        pageView.isSpreadHalf = isSpreadHalf
        pageView.spineSide = spine
        self.chromeVisible = chromeVisible
        self.onTapCentre = onTapCentre
        self.onTapWord = onTapWord
        self.onLongPressAyah = onLongPressAyah
        super.init(nibName: nil, bundle: nil)
        pageView.qiraat = qiraat
        pageView.highlightedWordIDs = highlightedWordIDs
        pageView.bookmarkedAyahs = bookmarkedAyahs
        pageView.isPageBookmarked = isPageBookmarked
    }

    /// The reader changed the Qiraat layer, appearance, or chrome state: redraw and update visibility.
    func apply(_ qiraat: QiraatDisplay,
               highlightedWordIDs: Set<String>,
               bookmarkedAyahs: Set<AyahKey>,
               isPageBookmarked: Bool,
               appearance: MushafAppearance,
               chromeVisible: Bool = false) {
        self.appearance = appearance
        pageView.appearance = appearance
        pageView.isSpreadHalf = isSpreadHalf
        let spine: PageLayoutConstants.SpineSide = !isSpreadHalf ? .none : page.isRightHandPage ? .left : .right
        pageView.spineSide = spine
        view.backgroundColor = appearance.desk(for: traitCollection)
        for label in [surahLabel, sectionLabel, pageNumberLabel] {
            label.textColor = appearance.ink(for: traitCollection)
        }
        pageView.qiraat = qiraat
        pageView.highlightedWordIDs = highlightedWordIDs
        pageView.bookmarkedAyahs = bookmarkedAyahs
        pageView.isPageBookmarked = isPageBookmarked
        updateBookStyling()
        setChromeVisible(chromeVisible, animated: true)
    }

    func setChromeVisible(_ visible: Bool, animated: Bool) {
        guard self.chromeVisible != visible else { return }
        self.chromeVisible = visible
        let targetAlpha: CGFloat = visible ? 0 : 1
        if animated && view.window != nil {
            UIView.animate(withDuration: 0.2) {
                self.surahLabel.alpha = targetAlpha
                self.sectionLabel.alpha = targetAlpha
            }
        } else {
            self.surahLabel.alpha = targetAlpha
            self.sectionLabel.alpha = targetAlpha
        }
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = appearance.desk(for: traitCollection)
        configureMetadataLabels()
        view.addSubview(pageView)
        tap.addTarget(self, action: #selector(tapped(_:)))
        view.addGestureRecognizer(tap)
        wordTap.addTarget(self, action: #selector(tappedWord(_:)))
        wordTap.delegate = self
        view.addGestureRecognizer(wordTap)
        tap.require(toFail: wordTap)

        longPress.minimumPressDuration = 0.45
        longPress.addTarget(self, action: #selector(longPressed(_:)))
        longPress.delegate = self
        view.addGestureRecognizer(longPress)
        tap.require(toFail: longPress)
    }

    override func didMove(toParent parent: UIViewController?) {
        super.didMove(toParent: parent)
        // Disable tap-to-turn gestures so turning pages is exclusively via swiping left and right.
        for recognizer in (parent as? UIPageViewController)?.gestureRecognizers ?? [] where recognizer is UITapGestureRecognizer {
            recognizer.isEnabled = false
        }
    }

    private var actualSafeAreaInsets: UIEdgeInsets {
        if let windowInsets = view.window?.safeAreaInsets, windowInsets.top > 0 {
            return windowInsets
        }
        if let parentInsets = parent?.view.safeAreaInsets, parentInsets.top > 0 {
            return parentInsets
        }
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let keyWindow = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first,
           keyWindow.safeAreaInsets.top > 0 {
            return keyWindow.safeAreaInsets
        }
        return view.safeAreaInsets
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let isPad = traitCollection.userInterfaceIdiom == .pad || UIDevice.current.userInterfaceIdiom == .pad
        let insets = actualSafeAreaInsets
        let safeTop = insets.top
        let safeBottom = insets.bottom

        let topBannerHeight: CGFloat = 52

        // Translate the window coordinates of ReaderTopBar and safe area into this view's local coordinate space.
        // This avoids double-insetting when UIPageViewController is hosted inside a safe-area-constrained parent.
        let viewOriginInWindow = view.convert(CGPoint.zero, to: nil)
        let windowSafeTop = view.window?.safeAreaInsets.top ?? safeTop
        let windowSafeBottom = view.window?.safeAreaInsets.bottom ?? safeBottom
        let windowHeight = view.window?.bounds.height ?? view.bounds.height

        let topBannerBottomInWindow = windowSafeTop + topBannerHeight
        let topY = max(0, topBannerBottomInWindow - viewOriginInWindow.y)

        let footerHeight: CGFloat = 34
        let windowBottomSafe = windowHeight - windowSafeBottom - footerHeight
        let bottomY = max(topY + 120, windowBottomSafe - viewOriginInWindow.y)
        let pageHeight = bottomY - topY

        if isPad {
            // Reserve top room for top bar / header and bottom page number
            let topInset: CGFloat = max(topY + 6, 60)
            let bottomInset: CGFloat = max(view.bounds.height - bottomY, 44)
            let area = CGRect(
                x: view.bounds.minX,
                y: view.bounds.minY + topInset,
                width: view.bounds.width,
                height: max(0, view.bounds.height - topInset - bottomInset)
            )
            let spine: PageLayoutConstants.SpineSide = !isSpreadHalf ? .none : page.isRightHandPage ? .left : .right
            pageView.frame = PageLayoutConstants.fittedPageRect(in: area, stretch: false, spine: spine).integral
        } else {
            // Mobile (iPhone): Page is stretched to fill the screen between the top header and bottom footer
            pageView.frame = CGRect(x: 0, y: topY, width: view.bounds.width, height: pageHeight)
        }

        pageView.isSpreadHalf = isSpreadHalf
        let spine: PageLayoutConstants.SpineSide = !isSpreadHalf ? .none : page.isRightHandPage ? .left : .right
        pageView.spineSide = spine
        updateBookStyling()
        layoutMetadataLabels(around: pageView.frame)
    }

    private func updateBookStyling() {
        if isSpreadHalf {
            pageView.layer.cornerRadius = 6
            if page.isRightHandPage {
                // Spine on left: curve outer top-right and bottom-right corners
                pageView.layer.maskedCorners = [.layerMaxXMinYCorner, .layerMaxXMaxYCorner]
            } else {
                // Spine on right: curve outer top-left and bottom-left corners
                pageView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMinXMaxYCorner]
            }
        } else {
            pageView.layer.cornerRadius = 6
            pageView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMinXMaxYCorner, .layerMaxXMinYCorner, .layerMaxXMaxYCorner]
        }
        pageView.layer.borderWidth = 0.5
        pageView.layer.borderColor = appearance.brown(for: traitCollection).withAlphaComponent(0.20).cgColor
        pageView.layer.shadowColor = UIColor.black.cgColor
        pageView.layer.shadowOpacity = isSpreadHalf ? 0.16 : 0.10
        pageView.layer.shadowRadius = 8
        pageView.layer.shadowOffset = CGSize(width: 0, height: 3)
    }

    private func configureMetadataLabels() {
        let meta = page.metadata
        let font = UIFont.systemFont(ofSize: isSpreadHalf ? 13 : 16, weight: .medium)
        for label in [surahLabel, sectionLabel, pageNumberLabel] {
            label.font = font
            label.textColor = appearance.ink(for: traitCollection)
            label.backgroundColor = .clear
            label.isUserInteractionEnabled = false
            view.addSubview(label)
        }
        surahLabel.isHidden = true
        sectionLabel.isHidden = true
        pageNumberLabel.text = arabicIndic(page.number)
        pageNumberLabel.textAlignment = .center
        pageNumberLabel.accessibilityLabel = "صفحة \(page.number)"
    }

    private func layoutMetadataLabels(around paperFrame: CGRect) {
        surahLabel.isHidden = true
        sectionLabel.isHidden = true

        // Bottom page number location: odd number on the right, even number on the left
        // Large clean numbers without ornamental ayah rosette
        pageNumberLabel.isHidden = false
        pageNumberLabel.font = UIFont.systemFont(ofSize: isSpreadHalf ? 18 : 22, weight: .bold)
        let bottomY = paperFrame.maxY + 4
        let isOdd = page.number % 2 != 0
        let numberWidth: CGFloat = 90
        let horizontalInset = max(16, paperFrame.width * 0.04)
        if isOdd {
            pageNumberLabel.frame = CGRect(x: paperFrame.maxX - horizontalInset - numberWidth, y: bottomY, width: numberWidth, height: 28)
            pageNumberLabel.textAlignment = .right
        } else {
            pageNumberLabel.frame = CGRect(x: paperFrame.minX + horizontalInset, y: bottomY, width: numberWidth, height: 28)
            pageNumberLabel.textAlignment = .left
        }
    }

    private func arabicIndic(_ value: Int) -> String {
        String(value).map { character in
            guard let digit = character.wholeNumberValue else { return character }
            return Character(String(UnicodeScalar(0x0660 + digit)!))
        }.reduce(into: "") { $0.append($1) }
    }

    @objc private func tappedWord(_ recognizer: UITapGestureRecognizer) {
        if let word = pageView.markedWord(at: recognizer.location(in: pageView)) { onTapWord(page, word) }
    }

    // A tap on a marked word opens its Qiraat card; anywhere else the recognizer never begins, so
    // the chrome tap is not delayed.
    func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
        guard recognizer === wordTap else { return true }
        return pageView.markedWord(at: recognizer.location(in: pageView)) != nil
    }

    func gestureRecognizer(_ recognizer: UIGestureRecognizer,
                           shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
        recognizer === wordTap && other is UITapGestureRecognizer && other !== tap
    }

    @objc private func tapped(_ recognizer: UITapGestureRecognizer) {
        // Tapping anywhere toggles chrome; turning pages is only by swiping left and right.
        onTapCentre()
    }

    @objc private func longPressed(_ recognizer: UILongPressGestureRecognizer) {
        guard recognizer.state == .began else { return }
        let location = recognizer.location(in: pageView)
        if let ayah = pageView.ayahKey(at: location) {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            onLongPressAyah?(page, ayah)
        }
    }
}
