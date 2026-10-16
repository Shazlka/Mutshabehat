import SwiftUI
import UIKit

@main
struct MutshabehatApp: App {
    @State private var library = MushafLibrary.load()

    init() {
#if DEBUG
        // The iPad UI tests set this: the simulator's keyboard hide animation sometimes never reports completion
        // to the test runner, which then waits minutes for an idle app that is in fact idle. DEBUG builds only.
        if ProcessInfo.processInfo.environment["QIRAAT_UI_TEST_NO_ANIMATIONS"] == "1" {
            UIView.setAnimationsEnabled(false)
        }
#endif
    }

    var body: some Scene {
        WindowGroup {
            switch library {
            case let .success(library):
                ReaderView(library: library)
            case let .failure(error):
                // Only reachable if the build shipped without its generated data (see project.yml).
                Text("تعذّر فتح بيانات المصحف\n\(error.localizedDescription)")
                    .multilineTextAlignment(.center)
                    .padding()
            }
        }
    }
}
