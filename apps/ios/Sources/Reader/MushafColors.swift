import UIKit

extension UIColor {
    static let mushafPaper = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.11, green: 0.105, blue: 0.09, alpha: 1)
            : UIColor(red: 1, green: 0.992, blue: 0.965, alpha: 1)
    }
    static let mushafInk = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.92, green: 0.91, blue: 0.86, alpha: 1)
            : UIColor(red: 0.09, green: 0.09, blue: 0.09, alpha: 1)
    }
    static let mushafGold = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.78, green: 0.67, blue: 0.38, alpha: 1)
            : UIColor(red: 0.604, green: 0.482, blue: 0.208, alpha: 1)
    }
    static let mushafBrown = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.82, green: 0.74, blue: 0.55, alpha: 1)
            : UIColor(red: 0.349, green: 0.275, blue: 0.114, alpha: 1)
    }
}
