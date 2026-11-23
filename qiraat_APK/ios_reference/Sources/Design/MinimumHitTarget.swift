import SwiftUI

extension View {
    /// Gives a small icon button the 44×44 pt tap area the Human Interface Guidelines ask for, without changing how
    /// the icon looks (the same pattern as the Mutoon clear button: a 44 pt frame and a rectangular content shape).
    ///
    /// `overhang` keeps a compact row from growing: that many points of the extra height are taken back from the
    /// layout with negative padding, so the tap area spills above and below the row instead of making it taller.
    /// Use it where the button appears and disappears inside a field (a clear button), so the field does not jump.
    func minimumHitTarget(overhang: CGFloat = 0) -> some View {
        frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
            .padding(.vertical, -overhang)
    }
}
