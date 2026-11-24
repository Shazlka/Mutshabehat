import SwiftUI

struct CloudAccountView: View {
    let account: CloudAccount
    let library: MushafLibrary
    var isSetup = false
    @State private var confirmingGuestImport = false
    @State private var creating = false
    @State private var email = ""
    @State private var password = ""
    @FocusState private var field: Field?
    private enum Field { case email, password }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else { return }
        field = nil
        let (address, secret, create) = (email, password, creating)
        Task {
            await account.signIn(email: address, password: secret, create: create)
            if account.accountID != nil { password = "" }
        }
    }

    var body: some View {
        Form {
            if account.configuration == nil {
                Text("خدمة المزامنة غير مهيأة في هذا الإصدار.")
            } else if account.accountID == nil {
                Section {
                    Picker("", selection: $creating) {
                        Text("تسجيل الدخول").tag(false)
                        Text("حساب جديد").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("cloud-mode")
                    TextField("البريد الإلكتروني", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($field, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { field = .password }
                        .accessibilityIdentifier("cloud-email")
                    SecureField("كلمة المرور (٨ أحرف على الأقل)", text: $password)
                        .textContentType(creating ? .newPassword : .password)
                        .focused($field, equals: .password)
                        .submitLabel(.go)
                        .onSubmit(submit)
                        .accessibilityIdentifier("cloud-password")
                    Button(creating ? "إنشاء حساب" : "تسجيل الدخول", action: submit)
                        .buttonStyle(.borderedProminent)
                        .disabled(email.isEmpty || password.isEmpty)
                        .accessibilityIdentifier("cloud-submit")
                } footer: {
                    Text("سجّل مرة واحدة واستخدم الحساب نفسه على iPhone وAndroid لمزامنة الختمة والحفظ فورًا. لا يُفتح المتصفح، وكلمة المرور لا تُحفظ على الجهاز.")
                }
                Section {
                    Button("المتابعة بحساب Google") { Task { await account.signInWithBrowser() } }
                } footer: {
                    Text("Google فقط يفتح صفحة تسجيل الدخول من Google.")
                }
            } else {
                Section {
                    HStack(spacing: 14) {
                        Image(systemName: "person.crop.circle.fill").font(.system(size: 40)).foregroundStyle(.green)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(account.displayName ?? "").font(.headline).accessibilityIdentifier("cloud-name")
                            if let email = account.email {
                                Text(email).font(.subheadline).foregroundStyle(.secondary).accessibilityIdentifier("cloud-email-shown")
                            }
                            Label(account.busy ? "جاري المزامنة..." : "متزامن", systemImage: account.busy ? "arrow.triangle.2.circlepath" : "checkmark.circle.fill")
                                .font(.caption).foregroundStyle(account.busy ? Color.secondary : Color.green)
                        }
                    }
                }
                if isSetup {
                    Text("يمكنك نسخ تقدّم الضيف قبل فتح المصحف. إذا كان لديك تقدّم على جهاز آخر، اختر المتابعة لمزامنته.")
                    Button("متابعة", action: account.finishSetup)
                        .buttonStyle(.borderedProminent)
                }
                Section {
                    Button("مزامنة الآن") { Task { await account.sync(library: library) } }
                    if let last = account.lastSync {
                        Text(last, format: .dateTime)
                    }
                    Button("نسخ تقدّم الضيف إلى الحساب") { confirmingGuestImport = true }
                } footer: {
                    Text("يمكن نسخ تقدّم الضيف إلى قسم فارغ في الحساب. تبقى نسخة الضيف على الجهاز.")
                }
                ForEach(ProgressDataset.allCases, id: \.self) { item in
                    if account.conflicts[item] != nil {
                        Section(item.title) {
                            Text("تغيّر التقدّم على هذا الجهاز وفي السحابة. اختر النسخة التي تريد الاحتفاظ بها.")
                            Button("استخدام تقدّم هذا الجهاز") {
                                Task { await account.sync(library: library, resolution: .device, dataset: item) }
                            }
                            Button("استخدام تقدّم السحابة") {
                                Task { await account.sync(library: library, resolution: .cloud, dataset: item) }
                            }
                        }
                    }
                }
                Button("تسجيل الخروج", role: .destructive) { account.signOut() }
            }
            if account.busy { ProgressView() }
            if let error = account.error { Text(error).foregroundStyle(.red) }
        }
        .disabled(account.busy)
        .navigationTitle("الحساب والمزامنة")
        .confirmationDialog("نسخ تقدّم الضيف إلى هذا الحساب؟", isPresented: $confirmingGuestImport, titleVisibility: .visible) {
            Button("نسخ التقدّم") { Task { await account.sync(library: library, importGuest: true) } }
        }
    }
}
