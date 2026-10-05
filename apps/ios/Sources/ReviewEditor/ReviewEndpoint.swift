#if DEBUG
import Foundation

/// The strings that identify the web review API. They live here, in the DEBUG-only editor, so that
/// `make release-guard` can prove a Release build carries none of them.
enum ReviewEndpoint {
    static let path = "api/mushaf-1441/qiraat-review"
    static let deviceKey = "qiraat-review-device-id"
}
#endif
