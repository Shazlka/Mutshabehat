import SwiftUI

/// A one-time hint over the Mushaf telling a new reader what the coloured words are for. Dismissing it
/// is remembered; the reader view decides where it sits, and may set the same key when a word is first opened.
struct QiraatFirstUseHint: View {
    static let storageKey = "qiraat:first-use-hint:v1"

    @AppStorage(storageKey) private var dismissed = false

    var body: some View {
        if !dismissed {
            ZStack(alignment: .trailing) {
                HStack(spacing: 8) {
                    Image(systemName: "hand.tap").font(.body.bold()).accessibilityHidden(true)
                    Text("المس كلمة ملوّنة لعرض قراءاتها").font(.subheadline.bold())
                        .dynamicTypeSize(...DynamicTypeSize.xLarge)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(.leading, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(.qiraatBadgeFill))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.qiraatCardStroke))
                .allowsHitTesting(false)

                Button {
                    withMotion { dismissed = true }
                } label: {
                    Image(systemName: "xmark").font(.body.bold()).frame(width: 44, height: 44).contentShape(Rectangle())
                }
                .accessibilityLabel("إخفاء التلميح")
                .accessibilityIdentifier("qiraat-first-use-hint-dismiss")
            }
            .foregroundStyle(.qiraatBadgeInk)
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("qiraat-first-use-hint")
            .transition(.opacity)
            .task {
                try? await Task.sleep(for: .seconds(8))
                withMotion { dismissed = true }
            }
        }
    }
}
