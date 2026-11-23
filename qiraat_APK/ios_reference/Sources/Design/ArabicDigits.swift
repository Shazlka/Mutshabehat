/// Arabic-Indic digits (٠١٢…) for numbers shown in Arabic text: page, juz, hizb, ayah counts.
/// `MemorizationTheme.number` is the variant that also adds thousands separators and follows the app language.
enum ArabicDigits {
    static func string(_ value: Int) -> String {
        String(String(value).unicodeScalars.map { scalar -> Character in
            guard let digit = Int(String(scalar)) else { return Character(scalar) }
            return Character(UnicodeScalar(0x0660 + digit)!)
        })
    }
}
