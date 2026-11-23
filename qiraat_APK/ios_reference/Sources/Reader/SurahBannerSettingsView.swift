import MushafCore
import SwiftUI
import UIKit

/// Settings → «شكل ترويسة السورة»: every banner drawn as it appears on the page (سورة الحشر, 59, 24 ayahs).
struct SurahBannerSettingsView: View {
    @Binding var style: String
    let language: AppLanguage

    var body: some View {
        List(SurahBannerStyle.allCases) { option in
            Button {
                style = option.rawValue
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(option.title(language))
                        Spacer()
                        if SurahBannerStyle(stored: style) == option {
                            Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                        }
                    }
                    SurahBannerPreview(style: option)
                        .aspectRatio(SurahBannerPreview.aspect, contentMode: .fit)
                        .accessibilityHidden(true)
                }
                .padding(.vertical, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(SurahBannerStyle(stored: style) == option ? .isSelected : [])
            .accessibilityIdentifier("surah-banner-\(option.rawValue)")
        }
        .navigationTitle(language == .english ? "Surah banner" : "شكل ترويسة السورة")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One banner, drawn by the same code as the page.
struct SurahBannerPreview: View {
    let style: SurahBannerStyle
    /// About a banner's proportions on the page.
    static let aspect: CGFloat = 8.5

    var body: some View {
        GeometryReader { proxy in
            if let image = Self.render(style, size: proxy.size) {
                Image(uiImage: image).resizable()
            }
        }
    }

    static func render(_ style: SurahBannerStyle, size: CGSize) -> UIImage? {
        guard size.width > 0, size.height > 0 else { return nil }
        let frame = CGRect(origin: .zero, size: size)
        return UIGraphicsImageRenderer(size: size).image { renderer in
            let context = renderer.cgContext
            let prefix = "سُورَةُ "
            let title = prefix + "الحَشْرِ"
            if let art = style.art {
                art.draw(in: frame, title: title, prefixLength: (prefix as NSString).length, surahNumber: 59,
                         ayahCount: 24, titleFont: { MushafLibrary.mushafFont(size: $0) }, context: context)
            } else {
                // The classic banner is tinted to the page's theme; here in the light theme's brown.
                let brown = MushafAppearance.light.brown(for: UITraitCollection(userInterfaceStyle: .light))
                UIImage(named: "SurahBannerTemplate")?.withTintColor(brown).draw(in: frame)
                let attributes: [NSAttributedString.Key: Any] = [
                    .font: MushafLibrary.mushafFont(size: size.height * 0.5),
                    .foregroundColor: MushafAppearance.light.ink(for: UITraitCollection(userInterfaceStyle: .light)),
                ]
                let text = title as NSString
                let textSize = text.size(withAttributes: attributes)
                text.draw(at: CGPoint(x: frame.midX - textSize.width / 2, y: frame.midY - textSize.height / 2),
                          withAttributes: attributes)
            }
        }
    }
}
