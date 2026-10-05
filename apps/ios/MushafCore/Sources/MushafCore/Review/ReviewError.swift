import Foundation

/// The error codes of the web review API, with the raw strings the server sends.
public enum ReviewErrorCode: String, Sendable, Hashable, CaseIterable {
    case unauthorized
    case forbidden
    case versionConflict = "VERSION_CONFLICT"
    case ruleD8 = "RULE_D8"
    case ruleNarratorTwice = "RULE_NARRATOR_TWICE"
    case ruleEmptyLocation = "RULE_EMPTY_LOCATION"
    case ruleWaslWaqf = "RULE_WASL_WAQF"
    case undoConflict = "UNDO_CONFLICT"
    case undoRefused = "UNDO_REFUSED"
    case notFound = "not_found"
    case badRequest = "bad_request"
    case unavailable

    /// The message shown when the server did not send its own `messageAr`.
    var defaultMessageAr: String {
        switch self {
        case .unauthorized: "غير مصرح"
        case .forbidden: "غير مصرح لك بالتعديل"
        case .versionConflict: "عُدِّل هذا الوجه من مكان آخر — أُعيد تحميله"
        case .ruleD8: "حفص هو الأصل: لا يُذكر إلا وجهًا ثانيًا مع ملاحظة"
        case .ruleNarratorTwice: "راوٍ مكرر في هذا الموضع دون وجه مستقل"
        case .ruleEmptyLocation: "لا بد من قراءة واحدة على الأقل في الموضع"
        case .ruleWaslWaqf: "لا بد أن ينطبق الموضع على الوصل أو الوقف على الأقل"
        case .undoConflict: "تغيّر هذا الموضع بعد العملية، فلا يمكن التراجع عنها"
        case .undoRefused: "لا يمكن التراجع عن هذه العملية"
        case .notFound: "لم يُعثر على الوجه — ربما حُذف"
        case .badRequest: "طلب غير صالح"
        case .unavailable: "تعذّر إكمال الطلب"
        }
    }
}

public struct ReviewError: Error, Equatable, Sendable {
    public let code: ReviewErrorCode
    public let status: Int
    public let messageAr: String

    public init(code: ReviewErrorCode, status: Int, messageAr: String? = nil) {
        self.code = code
        self.status = status
        self.messageAr = messageAr ?? code.defaultMessageAr
    }

    public static let offline = ReviewError(
        code: .unavailable, status: 0,
        messageAr: "تعذّر الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة")
    public static let timedOut = ReviewError(
        code: .unavailable, status: 0,
        messageAr: "انتهت مهلة الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة")
    public static let invalidResponse = ReviewError(
        code: .unavailable, status: 0, messageAr: "استجابة غير صالحة من الخادم")
}
