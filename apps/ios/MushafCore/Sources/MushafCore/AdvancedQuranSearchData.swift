import Foundation

public enum SurahRevelationType: String, Sendable, CaseIterable {
    case makkiyah = "مكية"
    case madaniyah = "مدنية"
}

public struct SurahMetadataInfo: Sendable {
    public let number: Int
    public let name: String
    public let ayahCount: Int
    public let type: SurahRevelationType
    public let revelationOrder: Int
}

public struct SajdahVerseInfo: Sendable {
    public let surah: Int
    public let ayah: Int
    public let isObligatory: Bool // واجبة (العزائم) vs مستحبة
}

public enum AdvancedQuranSearchData: Sendable {
    /// 15 Quranic Sajdah verses
    public static let sajdahVerses: [SajdahVerseInfo] = [
        SajdahVerseInfo(surah: 7, ayah: 206, isObligatory: false),
        SajdahVerseInfo(surah: 13, ayah: 15, isObligatory: false),
        SajdahVerseInfo(surah: 16, ayah: 50, isObligatory: false),
        SajdahVerseInfo(surah: 17, ayah: 109, isObligatory: false),
        SajdahVerseInfo(surah: 19, ayah: 58, isObligatory: false),
        SajdahVerseInfo(surah: 22, ayah: 18, isObligatory: false),
        SajdahVerseInfo(surah: 22, ayah: 77, isObligatory: false),
        SajdahVerseInfo(surah: 25, ayah: 60, isObligatory: false),
        SajdahVerseInfo(surah: 27, ayah: 26, isObligatory: false),
        SajdahVerseInfo(surah: 32, ayah: 15, isObligatory: true),  // سجدة العزائم
        SajdahVerseInfo(surah: 38, ayah: 24, isObligatory: false),
        SajdahVerseInfo(surah: 41, ayah: 38, isObligatory: true),  // سجدة العزائم
        SajdahVerseInfo(surah: 53, ayah: 62, isObligatory: true),  // سجدة العزائم
        SajdahVerseInfo(surah: 84, ayah: 21, isObligatory: false),
        SajdahVerseInfo(surah: 96, ayah: 19, isObligatory: true)   // سجدة العزائم
    ]

    /// 114 Surahs with revelation order and Meccan/Medinan classification
    public static let surahMetadata: [Int: SurahMetadataInfo] = {
        // [Number: (Name, AyahCount, Type, RevelationOrder)]
        let list: [(Int, String, Int, SurahRevelationType, Int)] = [
            (1, "الفاتحة", 7, .makkiyah, 5),
            (2, "البقرة", 286, .madaniyah, 87),
            (3, "آل عمران", 200, .madaniyah, 89),
            (4, "النساء", 176, .madaniyah, 92),
            (5, "المائدة", 120, .madaniyah, 112),
            (6, "الأنعام", 165, .makkiyah, 55),
            (7, "الأعراف", 206, .makkiyah, 39),
            (8, "الأنفال", 75, .madaniyah, 88),
            (9, "التوبة", 129, .madaniyah, 113),
            (10, "يونس", 109, .makkiyah, 51),
            (11, "هود", 123, .makkiyah, 52),
            (12, "يوسف", 111, .makkiyah, 53),
            (13, "الرعد", 43, .madaniyah, 96),
            (14, "إبراهيم", 52, .makkiyah, 72),
            (15, "الحجر", 99, .makkiyah, 54),
            (16, "النحل", 128, .makkiyah, 70),
            (17, "الإسراء", 111, .makkiyah, 50),
            (18, "الكهف", 110, .makkiyah, 69),
            (19, "مريم", 98, .makkiyah, 44),
            (20, "طه", 135, .makkiyah, 45),
            (21, "الأنبياء", 112, .makkiyah, 73),
            (22, "الحج", 78, .madaniyah, 103),
            (23, "المؤمنون", 118, .makkiyah, 74),
            (24, "النور", 64, .madaniyah, 102),
            (25, "الفرقان", 77, .makkiyah, 42),
            (26, "الشعراء", 227, .makkiyah, 47),
            (27, "النمل", 93, .makkiyah, 48),
            (28, "القصص", 88, .makkiyah, 49),
            (29, "العنكبوت", 69, .makkiyah, 85),
            (30, "الروم", 60, .makkiyah, 84),
            (31, "لقمان", 34, .makkiyah, 57),
            (32, "السجدة", 30, .makkiyah, 75),
            (33, "الأحزاب", 73, .madaniyah, 90),
            (34, "سبإ", 54, .makkiyah, 58),
            (35, "فاطر", 45, .makkiyah, 43),
            (36, "يس", 83, .makkiyah, 41),
            (37, "الصافات", 182, .makkiyah, 56),
            (38, "ص", 88, .makkiyah, 38),
            (39, "الزمر", 75, .makkiyah, 59),
            (40, "غافر", 85, .makkiyah, 60),
            (41, "فصلت", 54, .makkiyah, 61),
            (42, "الشورى", 53, .makkiyah, 62),
            (43, "الزخرف", 89, .makkiyah, 63),
            (44, "الدخان", 59, .makkiyah, 64),
            (45, "الجاثية", 37, .makkiyah, 65),
            (46, "الأحقاف", 35, .makkiyah, 66),
            (47, "محمد", 38, .madaniyah, 95),
            (48, "الفتح", 29, .madaniyah, 111),
            (49, "الحجرات", 18, .madaniyah, 106),
            (50, "ق", 45, .makkiyah, 34),
            (51, "الذاريات", 60, .makkiyah, 67),
            (52, "الطور", 49, .makkiyah, 76),
            (53, "النجم", 62, .makkiyah, 23),
            (54, "القمر", 55, .makkiyah, 37),
            (55, "الرحمن", 78, .madaniyah, 97),
            (56, "الواقعة", 96, .makkiyah, 46),
            (57, "الحديد", 29, .madaniyah, 94),
            (58, "المجادلة", 22, .madaniyah, 105),
            (59, "الحشر", 24, .madaniyah, 101),
            (60, "الممتحنة", 13, .madaniyah, 91),
            (61, "الصف", 14, .madaniyah, 109),
            (62, "الجمعة", 11, .madaniyah, 110),
            (63, "المنافقون", 11, .madaniyah, 104),
            (64, "التغابن", 18, .madaniyah, 108),
            (65, "الطلاق", 12, .madaniyah, 99),
            (66, "التحريم", 12, .madaniyah, 107),
            (67, "الملك", 30, .makkiyah, 77),
            (68, "القلم", 52, .makkiyah, 2),
            (69, "الحاقة", 52, .makkiyah, 78),
            (70, "المعارج", 44, .makkiyah, 79),
            (71, "نوح", 28, .makkiyah, 71),
            (72, "الجن", 28, .makkiyah, 40),
            (73, "المزمل", 20, .makkiyah, 3),
            (74, "المدثر", 56, .makkiyah, 4),
            (75, "القيامة", 40, .makkiyah, 31),
            (76, "الإنسان", 31, .madaniyah, 98),
            (77, "المرسلات", 50, .makkiyah, 33),
            (78, "النبإ", 40, .makkiyah, 80),
            (79, "النازعات", 46, .makkiyah, 81),
            (80, "عبس", 42, .makkiyah, 24),
            (81, "التكوير", 29, .makkiyah, 7),
            (82, "الانفطار", 19, .makkiyah, 82),
            (83, "المطففين", 36, .makkiyah, 86),
            (84, "الانشقاق", 25, .makkiyah, 83),
            (85, "البروج", 22, .makkiyah, 27),
            (86, "الطارق", 17, .makkiyah, 36),
            (87, "الأعلى", 19, .makkiyah, 8),
            (88, "الغاشية", 26, .makkiyah, 68),
            (89, "الفجر", 30, .makkiyah, 10),
            (90, "البلد", 20, .makkiyah, 35),
            (91, "الشمس", 15, .makkiyah, 26),
            (92, "الليل", 21, .makkiyah, 9),
            (93, "الضحى", 11, .makkiyah, 11),
            (94, "الشرح", 8, .makkiyah, 12),
            (95, "التين", 8, .makkiyah, 28),
            (96, "العلق", 19, .makkiyah, 1),
            (97, "القدر", 5, .makkiyah, 25),
            (98, "البينة", 8, .madaniyah, 100),
            (99, "الزلزلة", 8, .madaniyah, 93),
            (100, "العاديات", 11, .makkiyah, 14),
            (101, "القارعة", 11, .makkiyah, 30),
            (102, "التكاثر", 8, .makkiyah, 16),
            (103, "العصر", 3, .makkiyah, 13),
            (104, "الهمزة", 9, .makkiyah, 32),
            (105, "الفيل", 5, .makkiyah, 19),
            (106, "قريش", 4, .makkiyah, 29),
            (107, "الماعون", 7, .makkiyah, 17),
            (108, "الكوثر", 3, .makkiyah, 15),
            (109, "الكافرون", 6, .makkiyah, 18),
            (110, "النصر", 3, .madaniyah, 114),
            (111, "المسد", 5, .makkiyah, 6),
            (112, "الإخلاص", 4, .makkiyah, 22),
            (113, "الفلق", 5, .makkiyah, 20),
            (114, "الناس", 6, .makkiyah, 21)
        ]
        var map: [Int: SurahMetadataInfo] = [:]
        for (num, name, count, type, rev) in list {
            map[num] = SurahMetadataInfo(number: num, name: name, ayahCount: count, type: type, revelationOrder: rev)
        }
        return map
    }()

    /// Disjointed letters / Muqatta'at (فواتح السور والحروف المقطعة)
    public static let muqattaatList: [String] = [
        "الم", "المص", "الر", "المر", "كهيعص", "طه", "طسم", "طس", "يس", "ص", "حم", "عسق", "ق", "ن"
    ]
}
