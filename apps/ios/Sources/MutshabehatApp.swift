import SwiftUI

@main
struct MutshabehatApp: App {
    @State private var library = MushafLibrary.load()

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
