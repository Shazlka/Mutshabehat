import Foundation
import MushafCore

public enum MemorizationError: LocalizedError, Equatable {
    case alreadyUndone
    case notFound
    case notUndoable
    case nothingToApply
    case hasNewerChanges([BatchRecord])
    case writeFailed(String)

    public var errorDescription: String? {
        switch self {
        case .alreadyUndone: "تم التراجع عن هذه العملية من قبل."
        case .notFound: "لم يتم العثور على هذه العملية."
        case .notUndoable: "لا يمكن التراجع عن عملية تراجع."
        case .nothingToApply: "لا يوجد ما يمكن تحديثه."
        case let .hasNewerChanges(newer): "توجد تغييرات أحدث على نفس الآيات (\(newer.count))."
        case let .writeFailed(detail): "تعذر حفظ التغييرات: \(detail)"
        }
    }
}
