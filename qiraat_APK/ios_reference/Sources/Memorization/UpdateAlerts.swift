import MushafCore
import SwiftUI

/// The two alerts every memorization update sheet shows: «confirm this plan» and «could not update».
extension View {
    func updateConfirmationAlert(title: String, language: AppLanguage, pendingPlan: Binding<BatchPlan?>,
                                 message: String, commit: @escaping (BatchPlan) -> Void) -> some View {
        alert(title, isPresented: Binding(get: { pendingPlan.wrappedValue != nil }, set: { if !$0 { pendingPlan.wrappedValue = nil } })) {
            Button(language == .arabic ? "تأكيد" : "Confirm") {
                if let plan = pendingPlan.wrappedValue { commit(plan) }
            }
            Button(language == .arabic ? "إلغاء" : "Cancel", role: .cancel) { pendingPlan.wrappedValue = nil }
        } message: {
            Text(verbatim: message)
        }
    }

    func updateFailureAlert(language: AppLanguage, message: Binding<String?>) -> some View {
        alert(language == .arabic ? "تعذر التحديث" : "Could not update",
              isPresented: Binding(get: { message.wrappedValue != nil }, set: { if !$0 { message.wrappedValue = nil } })) {
            Button(language == .arabic ? "حسنًا" : "OK", role: .cancel) {}
        } message: {
            Text(verbatim: message.wrappedValue ?? "")
        }
    }
}
