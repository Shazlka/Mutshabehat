import SwiftUI
import UIKit

@main
struct MutshabehatApp: App {
    @State private var account = CloudAccount()

    var body: some Scene {
        WindowGroup {
            AccountReader(account: account).id(account.accountID)
        }
    }

    init() {
#if DEBUG
        // The iPad UI tests set this: the simulator's keyboard hide animation sometimes never reports completion
        // to the test runner, which then waits minutes for an idle app that is in fact idle. DEBUG builds only.
        if ProcessInfo.processInfo.environment["QIRAAT_UI_TEST_NO_ANIMATIONS"] == "1" {
            UIView.setAnimationsEnabled(false)
        }
#endif
    }
}

private struct AccountReader: View {
    let account: CloudAccount
    @State private var library: Result<MushafLibrary, Error>?

    var body: some View {
        Group {
            switch library {
            case let .success(library):
                if account.preparing {
                    NavigationStack {
                        CloudAccountView(account: account, library: library, isSetup: true)
                    }
                } else {
                    ReaderView(library: library)
                }
            case let .failure(error):
                ContentUnavailableView {
                    Label("تعذّر فتح بيانات المصحف", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(verbatim: error.localizedDescription)
                } actions: {
                    Button("إعادة المحاولة") { load() }
                        .buttonStyle(.borderedProminent)
                }
            case nil:
                ProgressView()
            }
        }
        .task { if library == nil { load() } }
    }

    private func load() {
        library = MushafLibrary.load(cloudAccount: account)
    }
}
