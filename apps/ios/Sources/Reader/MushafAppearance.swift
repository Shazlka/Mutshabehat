import SwiftUI
import UIKit

enum MushafAppearance: String, CaseIterable, Identifiable {
    case system
    case light
    case dark
    case whitePage
    case blackPage

    var id: Self { self }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light, .whitePage: .light
        case .dark, .blackPage: .dark
        }
    }

    var title: LocalizedStringKey {
        switch self {
        case .system: "تلقائي"
        case .light: "فاتح"
        case .dark: "داكن"
        case .whitePage: "صفحة بيضاء"
        case .blackPage: "صفحة سوداء"
        }
    }

    func paper(for traits: UITraitCollection) -> UIColor {
        switch self {
        case .whitePage: .white
        case .blackPage: .black
        case .system:
            traits.userInterfaceStyle == .dark ? Self.darkPaper : Self.lightPaper
        case .light: Self.lightPaper
        case .dark: Self.darkPaper
        }
    }

    func desk(for traits: UITraitCollection) -> UIColor {
        switch self {
        case .whitePage: UIColor(white: 0.92, alpha: 1)
        case .blackPage: UIColor(white: 0.025, alpha: 1)
        case .system:
            traits.userInterfaceStyle == .dark ? Self.darkDesk : Self.lightDesk
        case .light: Self.lightDesk
        case .dark: Self.darkDesk
        }
    }

    func ink(for traits: UITraitCollection) -> UIColor {
        switch self {
        case .blackPage: .white
        case .whitePage: .black
        case .system:
            traits.userInterfaceStyle == .dark ? Self.darkInk : Self.lightInk
        case .light: Self.lightInk
        case .dark: Self.darkInk
        }
    }

    func brown(for traits: UITraitCollection) -> UIColor {
        switch self {
        case .blackPage: UIColor(white: 0.78, alpha: 1)
        case .whitePage: UIColor(white: 0.20, alpha: 1)
        case .system:
            traits.userInterfaceStyle == .dark ? Self.darkBrown : Self.lightBrown
        case .light: Self.lightBrown
        case .dark: Self.darkBrown
        }
    }

    func gold(for traits: UITraitCollection) -> UIColor {
        switch self {
        case .blackPage: UIColor(red: 0.85, green: 0.72, blue: 0.38, alpha: 1)
        case .whitePage: UIColor(red: 0.72, green: 0.55, blue: 0.20, alpha: 1)
        case .system:
            traits.userInterfaceStyle == .dark ? Self.darkGold : Self.lightGold
        case .light: Self.lightGold
        case .dark: Self.darkGold
        }
    }

    private static let lightPaper = UIColor(red: 1, green: 0.992, blue: 0.965, alpha: 1)
    private static let darkPaper = UIColor(red: 0.11, green: 0.105, blue: 0.09, alpha: 1)
    private static let lightDesk = UIColor(red: 0.953, green: 0.929, blue: 0.867, alpha: 1)
    private static let darkDesk = UIColor(red: 0.055, green: 0.05, blue: 0.04, alpha: 1)
    private static let lightInk = UIColor(red: 0.09, green: 0.09, blue: 0.09, alpha: 1)
    private static let darkInk = UIColor(red: 0.92, green: 0.91, blue: 0.86, alpha: 1)
    private static let lightBrown = UIColor(red: 0.349, green: 0.275, blue: 0.114, alpha: 1)
    private static let darkBrown = UIColor(red: 0.82, green: 0.74, blue: 0.55, alpha: 1)
    private static let lightGold = UIColor(red: 0.78, green: 0.62, blue: 0.24, alpha: 1)
    private static let darkGold = UIColor(red: 0.88, green: 0.75, blue: 0.42, alpha: 1)
}
