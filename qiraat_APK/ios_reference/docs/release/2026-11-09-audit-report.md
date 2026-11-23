# Qiraat iOS — audit report (2026-11-09)

Six read-only reviews (performance, security and App Store, dead code, concurrency and data, UI/UX, plus an independent Codex review and a second Codex pass on the fixes). Everything below was checked in the code unless marked "unverified".

**Status: NOT ready to submit.** The code is in good shape; the blockers are content rights and licences, which only the owner can resolve.

---

## 1. Fixed in this round

| # | Area | Problem | Fix | Checked |
|---|---|---|---|---|
| 1 | Hang | Every view update re-read a Mushaf page from SQLite (3 queries, ~130 structs) | Cache of the last 12 pages | Build + tests; not profiled |
| 2 | Hang | Word card re-resolved every marked word on each redraw | Spans computed once into state | Build + simulator (card opens, 19/35 counter) |
| 3 | Menu | Scrolling inside a footer menu ran the row under the finger on lift, buzzed and moved the highlight | A touch that moves more than 10 pt is a scroll | Build; real drag UI test still to do |
| 4 | Page turn | New option: Curl or Slide (Settings → Page turn) | `PageTurnStyle`, `.scroll` pager, setting | Simulator, both directions |
| 5 | Page turn | Slide first turned the wrong way (found on the simulator) | Data source and animation direction swapped when sliding | Simulator |
| 6 | Accessibility | Reduce Motion still played the full curl on a finger drag | A single page slides with Reduce Motion | Unit test |
| 7 | Data | Reading-day keys became Hijri / Arabic digits on some locales | POSIX Gregorian ASCII keys | Unit test |
| 8 | Data | Qiraat restore deleted the live المتون data | Removes only `page-*.json` | Core test |
| 9 | Data | Public (Release) route accepted a suddenly much smaller page | Shrink guard on for the public route | Unit test |
| 10 | Data | Restore left the reading tracker stale | Reloads tracker, posts update | Build |
| 11 | Data | Qiraat sync signature saved before adopt succeeded | Saved after adopt | Build |
| 12 | Crash | NULL text columns trapped in merges | Null-safe reader | Unit test |
| 13 | Data | A last-read day ahead of today reset the streak | Counted as read today | Unit test |
| 14 | Backup | Background backup had no expiry handler | Added | Build |
| 15 | UI | Chevrons wrong way in English; verse buttons under 44 pt; index picker fixed width; two fonts did not scale | Fixed | Build |
| 16 | UI | Toasts and bottom bars were hand-made materials | Liquid Glass on iOS 26+, old look as fallback | Build; not seen on screen |
| 17 | Contrast | Legend and reader-picker colours low contrast in dark mode | Routed through the contrast helpers | Build; not seen on screen |
| 18 | Dead code | `MatnVerseRow`, two haptic helpers, `surahProgress`, `resetForTesting` | Deleted | Build + tests |

Tests: app 415/415. Release build and `release-guard`: pass. Core package: 1 failure, `validateAcceptsBundledMutshabehatSeed` — the generated seed file is in WAL mode; not touched by this work.

## 2. Still open (engineering)

| # | Severity | Item | Why open |
|---|---|---|---|
| E1 | Done | Backup safeguard now covers every database (row counts + guard) | Tests pass |
| E2 | Reduced | Tracker now publishes only changed values; still not profiled on a device | Profile |
| E3 | Medium | Restore and backup listing run on the main thread | Move to a worker |
| E4 | Medium | The hang is not profiled before and after | Needs ETTrace / Instruments on a device |
| E5 | Medium | Mutshabehat merge has no deletion tombstones (a deleted group can return) | Schema change |
| E6 | Medium | Security-scope access never released; iCloud placeholders can abort a merge | Debug-only today (iCloud off in Release) |
| E7 | Reduced | 274 English strings added; 480 now need a human review | Review |
| E8 | Low | Launch arguments such as `-page` work in Release | Wrap in DEBUG |
| E9 | Low | iOS 18 minimum keeps the fallbacks | Owner decision (O6) |
| E10 | Reduced | Glass added to header chips, iPad rail, search bar, Qiraat sheet; iPad rail and dark mode not yet seen on screen | Check |
| E11 | Low | Tests still to add: footer scroll UI test, slide direction UI test, VoiceOver pass | |

## 3. Needs the owner

| # | Severity | Item |
|---|---|---|
| O1 | BLOCKER | Written permission for the commentaries الوافي (القاضي) and الهادي (محيسن), or remove `mutoon-sharh.json` from Release |
| O2 | BLOCKER | Permission from nquran.com for about 23,000 Qiraat text fields, or rewrite them |
| O3 | High | Licence from Quran Foundation for the QCF fonts and `mushaf.sqlite` |
| O4 | High | Who made the app icon and the banner artwork, and under what licence |
| O5 | High | 116 private notes inside the 251 shipped groups |
| O6 | Medium | Decision: raise the minimum iOS from 18 to 26 (drops iOS 18–25 users) |
| O7 | Medium | Decision: Release live sync is cached; keep the shrink guard on (done) or accept deletions |
| O8 | Account | Apple Developer membership, App Store Connect record, legal name, support email, log retention, DSA status, final submit |

---

# تقرير فحص تطبيق «قراءات» (٩ نوفمبر ٢٠٢٦)

ست مراجعات للقراءة فقط (الأداء، الأمان والمتجر، الكود الميت، التزامن والبيانات، تجربة الاستخدام)، ومراجعة مستقلة من Codex ثم مراجعة ثانية للإصلاحات. كل ما يلي تم التحقق منه في الكود إلا ما كُتب أنه «غير مؤكد».

**الحالة: غير جاهز للتقديم.** الكود بحالة جيدة، والعوائق هي حقوق المحتوى والتراخيص، ولا يحلها إلا المالك.

## ١. ما تم إصلاحه

| # | المجال | المشكلة | الإصلاح |
|---|---|---|---|
| ١ | التجمّد | كل تحديث للشاشة كان يقرأ صفحة المصحف من قاعدة البيانات من جديد | ذاكرة مؤقتة لآخر ١٢ صفحة (لم تُقَس بعد) |
| ٢ | التجمّد | بطاقة الكلمة كانت تعيد حساب المواضع في كل رسم | الحساب مرة واحدة |
| ٣ | القوائم | التمرير داخل قائمة الشريط السفلي كان ينفّذ العنصر عند رفع الإصبع | الحركة أكثر من ١٠ نقاط تُعدّ تمريرًا |
| ٤ | تقليب الصفحة | خيار جديد: تقليب أو انزلاق | في الإعدادات |
| ٥ | تقليب الصفحة | الانزلاق كان باتجاه معكوس (اكتُشف على المحاكي) | صُحّح الاتجاه |
| ٦ | إمكانية الوصول | «تقليل الحركة» لم يمنع تقليب الصفحة ثلاثي الأبعاد بالسحب | الصفحة المفردة تنزلق عند تفعيله |
| ٧ | البيانات | مفاتيح أيام القراءة تصبح هجرية أو بأرقام عربية في بعض اللغات | مفاتيح ميلادية بأرقام لاتينية |
| ٨ | البيانات | استعادة نسخة القراءات كانت تحذف بيانات المتون الحية | تحذف ملفات الصفحات فقط |
| ٩ | البيانات | مسار الإصدار العام كان يقبل صفحة أصغر بكثير | حارس التقليص مفعّل |
| ١٠ | البيانات | بعد الاستعادة لا يُحدَّث متتبّع القراءة | يُعاد تحميله |
| ١١ | البيانات | توقيع القراءات يُحفظ قبل نجاح التبنّي | يُحفظ بعد النجاح |
| ١٢ | الانهيار | أعمدة نصية فارغة كانت توقف التطبيق عند الدمج | قراءة آمنة |
| ١٣ | البيانات | يوم قراءة في المستقبل يصفّر سلسلة الأيام | يُعدّ قراءة اليوم |
| ١٤ | النسخ الاحتياطي | لا معالج انتهاء للمهمة الخلفية | أُضيف |
| ١٥ | الواجهة | أسهم معكوسة بالإنجليزية، أزرار أصغر من ٤٤ نقطة، عنصر اختيار بعرض ثابت، خطان لا يكبّران | أُصلحت |
| ١٦ | الواجهة | شرائط وتنبيهات بخامات يدوية | زجاج «ليكويد» على iOS 26 فما فوق |
| ١٧ | التباين | ألوان دليل القراءات ضعيفة في الوضع الداكن | عبر دوال التباين |
| ١٨ | الكود الميت | خمس دوال وأنواع غير مستخدمة | حُذفت |

الاختبارات: ٤١٥ من ٤١٥ للتطبيق. بناء الإصدار وفحص التسرّب ناجحان. حزمة النواة: فشل واحد في اختبار البذرة (ملف مُولَّد بوضع WAL) لا علاقة له بهذا العمل.

## ٢. ما بقي (هندسيًا)

| # | الأهمية | البند |
|---|---|---|
| ١ | عالية | حماية النسخ الاحتياطي من النسخة الفارغة تشمل الحفظ فقط وليس القراءة والفواصل والمتشابهات |
| ٢ | متوسطة | مؤقّت القراءة كل ثانية يعيد رسم القارئ كاملًا (نقيس أولًا) |
| ٣ | متوسطة | الاستعادة وقائمة النسخ على الخيط الرئيسي |
| ٤ | متوسطة | لم نقس سبب التجمّد قبل وبعد (نحتاج Instruments على جهاز) |
| ٥ | متوسطة | دمج المتشابهات بلا سجل حذف (قد تعود مجموعة محذوفة) |
| ٦ | متوسطة | النصوص الإنجليزية ناقصة (٢٧٧ من ٦٧٦ مفتاحًا) |
| ٧ | منخفضة | وسائط الإطلاق مثل `-page` تعمل في الإصدار |
| ٨ | منخفضة | بقية تصميم الزجاج: خلفية بطاقة القراءات، شريط آيباد، البحث |

## ٣. يحتاج قرارك أو إجراءك

| # | الأهمية | البند |
|---|---|---|
| ١ | عائق | إذن كتابي بشرحَي «الوافي» (القاضي) و«الهادي» (محيسن)، أو إزالة ملف الشروح من الإصدار |
| ٢ | عائق | إذن من nquran.com لنحو ٢٣ ألف نص قراءات، أو إعادة صياغتها |
| ٣ | عالية | ترخيص مؤسسة القرآن (Quran Foundation) لخطوط QCF وقاعدة `mushaf.sqlite` |
| ٤ | عالية | مصدر وترخيص أيقونة التطبيق وصور الترويسات |
| ٥ | عالية | ١١٦ ملاحظة خاصة داخل المجموعات الـ٢٥١ المضمّنة |
| ٦ | متوسطة | قرار رفع الحد الأدنى من iOS 18 إلى 26 |
| ٧ | حساب | عضوية مطوّر Apple، سجل App Store Connect، الاسم القانوني، بريد الدعم، مدة حفظ السجلات، حالة DSA، التقديم النهائي |

---

## Final status (second round, 2026-11-09)

| Area | State |
|---|---|
| Unit tests | App 459/459, core package 550/550 |
| UI tests (iPhone 18 Pro Max sim) | ReaderUITests 25/25 (2 iPad-only skipped); Qiraat suites 69 run, 1 known failure that also fails before this work (HANDOFF.md) |
| Release build + leak guard | pass; the commentary file is no longer in a Release build unless `INCLUDE_COMMENTARY=YES` |
| Liquid Glass | seen on iPhone (light, dark) and iPad landscape |
| English | no entry left "needs review"; a native speaker should still read it |
| Done from the open list | E1, E3, E5, E6, E7, E8, E10 and most of E11; E2 reduced (not profiled on a device) |
| Left on purpose | the reading merge stays one transaction; haptics on the reading and undo screens keep their own feedback |

**Still needs you (cannot be done in code):** O1 commentary permission (now a build switch), O2 nquran.com, O3 Quran Foundation, O4 artwork, O5 private notes, O6 iOS minimum, O8 Apple account. Also a real-device pass: Instruments profile of the hang and a VoiceOver walk-through.

### الحالة النهائية (الجولة الثانية)

- اختبارات الوحدة: التطبيق ٤٥٩/٤٥٩ والنواة ٥٥٠/٥٥٠.
- اختبارات الواجهة على المحاكي: القارئ ٢٥/٢٥، واختبار واحد معروف يفشل أيضًا قبل هذا العمل (مسجّل في HANDOFF.md).
- بناء الإصدار وفحص التسرّب ناجحان، وملف الشروح لم يعد يدخل بناء الإصدار إلا بالإعداد `INCLUDE_COMMENTARY=YES`.
- زجاج «ليكويد» ظهر سليمًا على الآيفون (فاتح وداكن) وعلى الآيباد أفقيًا.
- ما زال بحاجة إليك: إذن الشروح، nquran.com، ترخيص مؤسسة القرآن، مصدر الصور، الملاحظات الخاصة، قرار الحد الأدنى لـ iOS، حساب Apple، وفحص على جهاز حقيقي (Instruments وVoiceOver).

### Owner decisions (2026-11-09, later)
- Minimum iOS raised to 26 (E9/O6 closed). Private notes ship only in the owner's own builds (O5 closed: Release bundle checked, 0 notes). Artwork: recorded as the owner's own AI-made work (O4 recorded; keep the tool's terms; classic banner reference still open).
- Open: O1 commentaries (build switch), O2 nquran.com, O3 Quran Foundation, O8 Apple account.

### قرارات المالك (لاحقًا)
- رُفع الحد الأدنى إلى iOS 26. الملاحظات الخاصة تبقى في نسختك فقط (تأكدت من حزمة الإصدار: صفر ملاحظات). الصور: مسجّلة أنها من عملك بأدوات ذكاء اصطناعي.
- ما زال مفتوحًا: الشروح (مفتاح بناء)، nquran.com، مؤسسة القرآن، حساب Apple.
