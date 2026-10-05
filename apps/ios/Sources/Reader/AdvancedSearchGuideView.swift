import SwiftUI

struct AdvancedSearchGuideItem: Identifiable {
    let id = UUID()
    let title: String
    let query: String
    let description: String?
}

struct AdvancedSearchGuideView: View {
    let onSelectQuery: (String) -> Void
    var bottomPadding: CGFloat
    @AppStorage("app:language:v1") private var language = AppLanguage.arabic.rawValue

    private var isArabic: Bool {
        language == AppLanguage.arabic.rawValue
    }

    init(bottomPadding: CGFloat = 120, onSelectQuery: @escaping (String) -> Void) {
        self.bottomPadding = bottomPadding
        self.onSelectQuery = onSelectQuery
    }

    // How to use advanced search tutorial items
    private var tutorials: [AdvancedSearchGuideItem] {
        if isArabic {
            return [
                AdvancedSearchGuideItem(
                    title: "البحث بالعبارة",
                    query: "\"رب العالمين\"",
                    description: "سيتم البحث عن العبارة كاملة لأن الكلمات محاطة بعلامات اقتباس."
                ),
                AdvancedSearchGuideItem(
                    title: "المعاملات المنطقية",
                    query: "الصلاة و الزكاة",
                    description: "استخدام المعامل المنطقي 'و' سيعرض الآيات التي تحتوي على كل هذه الكلمات معاً."
                ),
                AdvancedSearchGuideItem(
                    title: "جزء من كلمة",
                    query: "*نبي*",
                    description: "عند استخدام النجمة '*' فإنها تحل محل أي عدد من الحروف، فوضعها قبل الكلمة وبعدها يبحث عن جزء من الكلمة."
                ),
                AdvancedSearchGuideItem(
                    title: "حقول البحث",
                    query: "نوع_السورة:مكية و >صلاة",
                    description: "تمنحك حقول البحث تحكماً دقيقاً، مثل نوع السورة (مكية أو مدنية). هنا استخدمنا المعامل 'و' للبحث عن مشتقات 'صلاة' في السور المكية."
                ),
                AdvancedSearchGuideItem(
                    title: "المجالات والنطاقات",
                    query: "رقم_السورة:[1 الى 5] و الله",
                    description: "تُستخدم النطاقات مع الحقول العددية مثل رقم_السورة، فيمكنك استخدام مجال بدل رقم واحد مع إمكانية الجمع بالمعامل 'و'."
                ),
                AdvancedSearchGuideItem(
                    title: "التشكيل الجزئي",
                    query: "آية_:انْمَلَكُ",
                    description: "يمكنك البحث بالتشكيل الجزئي للكلمة، بشرط وضع حقل 'آية_:' قبل الكلمة، وإلا سيتم تجاهل التشكيل."
                ),
                AdvancedSearchGuideItem(
                    title: "خصائص الكلمة",
                    query: "{ملك،اسم}",
                    description: "البحث بخصائص الكلمة بوضع جذر الكلمة داخل أقواس {} متبوعاً بفاصلة ونوع الكلمة (حرف، اسم، أو فعل). مثال: {قول,اسم}."
                ),
                AdvancedSearchGuideItem(
                    title: "المشتقات والجذور",
                    query: ">ملك",
                    description: "يمكنك البحث بمشتقات الكلمة أو مشتقات الجذر بوضع الرمز > أو >> مباشرة قبل الكلمة."
                )
            ]
        } else {
            return [
                AdvancedSearchGuideItem(
                    title: "Phrase Search",
                    query: "\"رب العالمين\"",
                    description: "The full phrase will be searched because the words are enclosed in quotation marks."
                ),
                AdvancedSearchGuideItem(
                    title: "Logical Operators",
                    query: "الصلاة و الزكاة",
                    description: "Using the logical operator 'AND' will show verses containing all these words together."
                ),
                AdvancedSearchGuideItem(
                    title: "Part of a Word",
                    query: "*نبي*",
                    description: "When using the wildcard '*', it replaces any number of characters. So placing it before and after a word searches for part of the word."
                ),
                AdvancedSearchGuideItem(
                    title: "Search Fields",
                    query: "نوع_السورة:مكية و >صلاة",
                    description: "Search fields give you precise control over your search. For example, surah type (Meccan or Medinan). Here we use the logical operator 'AND' to search for derivatives of 'prayer' in Meccan surahs."
                ),
                AdvancedSearchGuideItem(
                    title: "Ranges",
                    query: "رقم_السورة:[1 الى 5] و الله",
                    description: "Search ranges are used with fields that accept numbers, like surah_number. You can use a range instead of a single number. Note that we also used the logical operator 'AND'."
                ),
                AdvancedSearchGuideItem(
                    title: "Partial Diacritics",
                    query: "آية_:انْمَلَكُ",
                    description: "You can search for a word with partial diacritics, but you must use the verse_: field before the word. Without this field, diacritics will be ignored."
                ),
                AdvancedSearchGuideItem(
                    title: "Word Properties",
                    query: "{ملك،اسم}",
                    description: "Searching by word properties is possible, but you must place the word root in curly braces {} followed by a comma and the word type (particle, noun, or verb). Example: {قول,noun}."
                ),
                AdvancedSearchGuideItem(
                    title: "Derivatives",
                    query: ">ملك",
                    description: "You can search by word derivatives or root derivatives using the > or >> symbol placed directly before the word."
                )
            ]
        }
    }

    // 23 Examples from screenshots
    private var examples: [AdvancedSearchGuideItem] {
        if isArabic {
            return [
                AdvancedSearchGuideItem(
                    title: "الآية الأكثر ذكراً لاسم الجلالة (الله)",
                    query: "(ج_آ:7) و >الله",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "الآية الأكثر كلمات في القرآن",
                    query: "ك_آ:[129 الى 200]",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "أطول آية في القرآن الكريم (آية الدَّيْن)",
                    query: "(ح_آ:[400 الى 900])",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "أطول كلمة في القرآن الكريم",
                    query: "فأسقيناكموه",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "السور التي عدد آياتها أكثر من 200 آية",
                    query: "آ_س:[200 الى 286] و رقم_الآية:200",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "أول آية أمرت بالسجود",
                    query: ">سجد",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "آيات السجدة في القرآن الكريم",
                    query: "(سجدة:نعم)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "السور التي تحتوي على سجدة واجبة (العزائم)",
                    query: "(سجدة:نعم) و نوع_السجدة:واجبة",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "سور القرآن مرتبة حسب ترتيب النزول",
                    query: "رقم_السورة:[1 الى 114] و رقم_الآية:1",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "السور المدنية في القرآن الكريم",
                    query: "نوع_السورة:مدنية و رقم_الآية:1",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "آيات التوبة والاستغفار",
                    query: "(><توب) و (><غفر)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "أكثر الأنبياء ذكراً في القرآن الكريم (موسى عليه السلام)",
                    query: ">>موسى",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "نداء الأب لأبنائه (بَنِيَّ / بُنَيَّ)",
                    query: "آية_:بَنِيَّ آية_:بُنَيَّ",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "الحروف المقطعة في أوائل السور",
                    query: "الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "الآيات ذات الكلمة الواحدة وليست حروفاً مقطعة",
                    query: "(ك_آ:1) وليس (الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "من هم الذين لا يحبهم الله",
                    query: "\"لا يحب\"",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "آيات التحدي والإعجاز في القرآن",
                    query: "(فأتوا و *سور*) أو (بمثل و القرآن) أو (فليأتوا و بحديث) أو (فأتوا و بكتاب)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "الصلاة في أوائل ما نزل من القرآن",
                    query: ">>صلاة",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "اسم حواء لم يُذكر صراحة في القرآن وإنما ذُكرت كزوج آدم",
                    query: "آدم و *زوج*",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "الذين لا خوف عليهم ولا هم يحزنون",
                    query: "خوف و يحزنون",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "آيات اللعن والملعونين",
                    query: ">لعن",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "الصبر على البلاء وجزاء الصابرين",
                    query: ">>صبر",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "صفات الذين يحبهم الله في القرآن الكريم",
                    query: "يحبكم >الله و يحب وليس لا",
                    description: nil
                )
            ]
        } else {
            return [
                AdvancedSearchGuideItem(
                    title: "The Verse with the Most Mentions of Allah's Name",
                    query: "(ج_آ:7) و >الله",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "The Verse with the Most Words",
                    query: "ك_آ:[129 الى 200]",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "The Longest Verse in the Holy Quran",
                    query: "(ح_آ:[400 الى 900])",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "The Longest Word in the Quran",
                    query: "فأسقيناكموه",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "How Many Surahs Have More Than 200 Verses",
                    query: "آ_س:[200 الى 286] و رقم_الآية:200",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "The First Verse Commanding Prostration",
                    query: ">سجد",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Which Verses in the Quran Require Prostration",
                    query: "(سجدة:نعم)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Surahs Containing Obligatory Prostration",
                    query: "(سجدة:نعم) و نوع_السجدة:واجبة",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Quran surahs displayed in revelation order",
                    query: "رقم_السورة:[1 الى 114] و رقم_الآية:1",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Medinan Surahs in the Holy Quran",
                    query: "نوع_السورة:مدنية و رقم_الآية:1",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Verses about Repentance and Forgiveness",
                    query: "(><توب) و (><غفر)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "The Most Mentioned Prophet in the Quran",
                    query: ">>موسى",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "A Father's Conversation with His Children",
                    query: "آية_:بَنِيَّ آية_:بُنَيَّ",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Muqatta'at are letters that begin some surahs",
                    query: "الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Single-Word Verses That Are Not Disconnected Letters",
                    query: "(ك_آ:1) وليس (الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Who Are Those Whom Allah Does Not Love",
                    query: "\"لا يحب\"",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Challenge Verses in the Quran",
                    query: "(فأتوا و *سور*) أو (بمثل و القرآن) أو (فليأتوا و بحديث) أو (فأتوا و بكتاب)",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Prayer in the Early Revelations of the Quran",
                    query: ">>صلاة",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "The name Eve (Hawwa) is not mentioned in the Quran; she is referred to as Adam's wife",
                    query: "آدم و *زوج*",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Who Are Those Who Shall Have No Fear Nor Grieve",
                    query: "خوف و يحزنون",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Verses about Curses and the Cursed",
                    query: ">لعن",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Patience in Adversity and the Reward of the Patient",
                    query: ">>صبر",
                    description: nil
                ),
                AdvancedSearchGuideItem(
                    title: "Qualities of Those Whom Allah Loves as Mentioned in the Quran",
                    query: "يحبكم >الله و يحب وليس لا",
                    description: nil
                )
            ]
        }
    }

    private var queryBoxBackground: Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 0.22, green: 0.21, blue: 0.20, alpha: 1.0)
                : UIColor(red: 0.94, green: 0.91, blue: 0.86, alpha: 1.0)
        })
    }

    private var queryTextColor: Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark ? .white : .black
        })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                // Section: How to use advanced search
                VStack(alignment: .leading, spacing: 14) {
                    Text(isArabic ? "كيفية استخدام البحث المتقدم:" : "How to use advanced search:")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 16)

                    ForEach(tutorials) { item in
                        Button {
                            onSelectQuery(item.query)
                        } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(item.title)
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(.primary)

                                HStack(spacing: 8) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(Color(uiColor: .systemGray3))
                                        .padding(.leading, 8)

                                    Spacer()

                                    Text(item.query)
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(queryTextColor)
                                        .environment(\.layoutDirection, .rightToLeft)
                                        .multilineTextAlignment(.center)

                                    Spacer()
                                        .frame(width: 22) // Visual balance for search icon
                                }
                                .frame(height: 38)
                                .frame(maxWidth: .infinity)
                                .background(queryBoxBackground)
                                .cornerRadius(8)

                                if let desc = item.description {
                                    Text(desc)
                                        .font(.system(size: 13, weight: .regular))
                                        .foregroundStyle(.secondary)
                                        .multilineTextAlignment(.leading)
                                        .lineSpacing(3)
                                }
                            }
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .cornerRadius(16)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(Color.black.opacity(0.04), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 16)
                    }
                }

                // Section: Advanced Search Examples
                VStack(alignment: .leading, spacing: 14) {
                    Text(isArabic ? "أمثلة على البحث المتقدم:" : "Advanced Search Examples:")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 16)
                        .padding(.top, 6)

                    ForEach(examples) { item in
                        Button {
                            onSelectQuery(item.query)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(isArabic ? "النتيجة المتوقعة:" : "Expected Result:")
                                    .font(.system(size: 13, weight: .regular))
                                    .foregroundStyle(.secondary)

                                Text(item.title)
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(.primary)
                                    .padding(.bottom, 2)

                                Text(isArabic ? "استعلام البحث:" : "Search Query:")
                                    .font(.system(size: 13, weight: .regular))
                                    .foregroundStyle(.secondary)

                                Text(item.query)
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(queryTextColor)
                                    .environment(\.layoutDirection, .rightToLeft)
                                    .multilineTextAlignment(.center)
                                    .lineLimit(1)
                                    .frame(height: 38)
                                    .frame(maxWidth: .infinity)
                                    .background(queryBoxBackground)
                                    .cornerRadius(8)
                            }
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .cornerRadius(16)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(Color.black.opacity(0.04), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 16)
                    }
                }
            }
            .padding(.top, 10)
            .padding(.bottom, bottomPadding)
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }
}
